import { HttpStatusCode } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';
import type {
	ApiPuzzle,
	CalibrationRound,
	CalibrationRoundPuzzles,
	Training,
} from '@chesspecker/api-definitions';
import { patchState, signalStore, withState } from '@ngrx/signals';

import type { TranslationRef } from '@app/definition/i18n.type';
import { I18n, i18nRef } from '@app/i18n';
import {
	TrainingAttemptRecord,
	TrainingRunSlot,
	describeOutcome,
	initialState,
	toSlot,
} from '@app/page/training/store/training-run-state';
import { TrainingRunRepository } from '@app/repository/training-run.repository';
import { ApiCancelledError } from '@app/util/api-cancelled-error';
import { HttpError } from '@app/util/http-error';
import { SolveTiming } from '@app/util/solve-timer';

/**
 * Drives one solving run — a calibration round, or a stretch of a cycle — against the
 * API. It owns the queue and the grading and knows nothing about the board: the page
 * hands it the verdict, it records it and decides what comes next.
 *
 * A graded exercise stays on the board until `advance()` is called, so a miss can be
 * looked at before it is left behind. The method allows no retry either way.
 */
// ToDo => online-only, and the app is meant to work without an account: every call here
// goes straight to the API, so a lost connection loses the run. Section 5 of the schema
// notes has the shape — the same tables as IndexedDB object stores, draft attempts that
// grow while the exercise is open, a `synced_at` per row, and an upload ordered
// training → goal/rounds/puzzles → cycles → items → attempts on registering.
@Injectable()
export class TrainingRunStore extends signalStore(
	{ protectedState: false },
	withState(initialState),
) {
	readonly isBusy = computed(() => this.isLoading() || this.isSubmitting());
	readonly hasNext = computed(() => null !== this.pending());

	/** The round closed without settling the level, so the calibration goes on in another one. */
	readonly hasNextRound = computed(
		() => 'raise' === this.roundOutcome() || 'lower' === this.roundOutcome(),
	);

	/** The round that accepted its band is the last one: the training moves on to planning. */
	readonly isCalibrated = computed(() => 'accept' === this.roundOutcome());

	private readonly runRepository = inject(TrainingRunRepository);

	async begin(training: Training): Promise<void> {
		patchState(this, { ...initialState, trainingUuid: training.uuid, isLoading: true });

		try {
			if ('calibrating' === training.status) {
				await this.beginCalibration(training.uuid);
			} else {
				patchState(this, { mode: 'cycle', current: await this.fetchNextSlot(training.uuid) });
			}

			patchState(this, { isLoading: false, isDone: null === this.current() });
		} catch (error) {
			this.fail(error, i18nRef(I18n.training.EXERCISE_LOAD_ERROR));
		}
	}

	/**
	 * Records how the exercise on screen went, once it is over. Woodpecker grades on the
	 * first try, so the verdict inside `record` was settled long before the exercise
	 * closed; this still runs once per exercise and is never revised.
	 *
	 * Devuelve si el API se quedó con el intento, que es lo que decide si la copia local
	 * puede darse por subida o sigue siendo la única que hay.
	 */
	async grade(record: TrainingAttemptRecord, timing: SolveTiming): Promise<boolean> {
		const uuid = this.trainingUuid();
		const current = this.current();

		if (null === uuid || null === current || null !== this.lastResult()) {
			return false;
		}

		patchState(this, {
			isSubmitting: true,
			error: null,
			lastResult: record.solved ? 'solved' : 'failed',
		});

		try {
			const isClosed =
				'calibration' === this.mode()
					? await this.gradeCalibration(uuid, current.puzzle, record, timing)
					: await this.gradeCycle(uuid, current, record, timing);

			patchState(this, { isSubmitting: false, isDone: isClosed });

			return true;
		} catch (error) {
			this.fail(error, i18nRef(I18n.training.ATTEMPT_RECORD_ERROR));

			return false;
		}
	}

	/**
	 * Opens the round the closed one asked for, without leaving the board: a scan is a
	 * single exercise, so going back to the training page between rounds is most of the
	 * calibration.
	 */
	async openNextRound(): Promise<void> {
		const uuid = this.trainingUuid();

		if (null === uuid || !this.hasNextRound()) {
			return;
		}

		patchState(this, { ...initialState, trainingUuid: uuid, isLoading: true });

		try {
			await this.beginCalibration(uuid);

			patchState(this, { isLoading: false, isDone: null === this.current() });
		} catch (error) {
			this.fail(error, i18nRef(I18n.training.NEXT_ROUND_ERROR));
		}
	}

	reset(): void {
		patchState(this, initialState);
	}

	/** Moves on to the exercise fetched while the graded one was still on screen. */
	advance(): void {
		const pending = this.pending();

		if (null === pending) {
			return;
		}

		const roundPosition =
			'calibration' === this.mode() ? (this.roundPosition() ?? 0) + 1 : this.roundPosition();

		patchState(this, {
			current: pending,
			pending: null,
			lastResult: null,
			notice: null,
			roundPosition,
		});
	}

	private async beginCalibration(uuid: string): Promise<void> {
		const rounds = await this.runRepository.listRounds(uuid);
		const last = rounds.at(-1);

		if ('pending' === last?.outcome) {
			this.openRound(last, await this.runRepository.listRoundPuzzles(uuid, last.uuid));

			return;
		}

		const { round, puzzles } = await this.runRepository.createRound(uuid);

		this.openRound(round, { total: puzzles.length, attempted: 0, puzzles });
	}

	/**
	 * A round resumed halfway is opened on the exercise it was left at, not on the first
	 * one it still has: what is left says nothing about how far in it is.
	 */
	private openRound(round: CalibrationRound, dealt: CalibrationRoundPuzzles): void {
		const [first, ...rest] = dealt.puzzles;

		patchState(this, {
			mode: 'calibration',
			round,
			roundPosition: undefined === first ? null : dealt.attempted + 1,
			roundTotal: dealt.total,
			current: undefined === first ? null : toSlot(first),
			queue: rest,
			notice: undefined === first ? i18nRef(I18n.training.EMPTY_BAND) : null,
		});
	}

	/** Reports whether the run is over, either because the round closed or it ran dry. */
	private async gradeCalibration(
		uuid: string,
		puzzle: ApiPuzzle,
		record: TrainingAttemptRecord,
		timing: SolveTiming,
	): Promise<boolean> {
		const round = this.round();

		if (null === round) {
			return true;
		}

		const { outcome } = await this.runRepository.submitCalibrationAttempt(uuid, {
			roundUuid: round.uuid,
			puzzleUuid: puzzle.uuid,
			...record,
			...timing,
		});

		if ('pending' !== outcome) {
			patchState(this, { queue: [], roundOutcome: outcome, notice: describeOutcome(outcome) });

			return true;
		}

		const [next, ...rest] = this.queue();

		patchState(this, {
			pending: undefined === next ? null : toSlot(next),
			queue: rest,
			notice: undefined === next ? i18nRef(I18n.training.ROUND_OUT_OF_EXERCISES) : null,
		});

		return undefined === next;
	}

	private async gradeCycle(
		uuid: string,
		current: TrainingRunSlot,
		record: TrainingAttemptRecord,
		timing: SolveTiming,
	): Promise<boolean> {
		if (null === current.cycleItemUuid) {
			return true;
		}

		const { cycleFinished } = await this.runRepository.submitCycleAttempt(uuid, {
			cycleItemUuid: current.cycleItemUuid,
			...record,
			...timing,
		});

		if (cycleFinished) {
			patchState(this, { notice: i18nRef(I18n.training.CYCLE_COMPLETE) });

			return true;
		}

		const next = await this.fetchNextSlot(uuid);

		patchState(this, {
			pending: next,
			notice: null === next ? i18nRef(I18n.training.CYCLE_COMPLETE) : null,
		});

		return null === next;
	}

	private async fetchNextSlot(uuid: string): Promise<TrainingRunSlot | null> {
		try {
			const item = await this.runRepository.getNextItem(uuid);

			return {
				puzzle: item.trainingPuzzle.puzzle,
				cycleItemUuid: item.uuid,
				position: item.position,
			};
		} catch (error) {
			// The endpoint answers 404 once the pass is complete, which is not a failure.
			if (!HttpError.hasStatus(error, HttpStatusCode.NotFound)) {
				throw error;
			}

			return null;
		}
	}

	private fail(error: unknown, fallback: TranslationRef): void {
		if (ApiCancelledError.is(error)) {
			patchState(this, { isLoading: false, isSubmitting: false });

			return;
		}

		patchState(this, {
			isLoading: false,
			isSubmitting: false,
			isDone: true,
			error: HttpError.toRef(error, fallback),
		});
	}
}
