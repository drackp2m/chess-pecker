import { Injectable, computed, inject } from '@angular/core';
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
import {
	CalibrationRoundRow,
	TrainingRow,
} from '@app/repository/definition/training-schema.interface';
import { SyncStore } from '@app/store/sync.store';
import {
	RunRoundPuzzles,
	TrainingRunEngineUseCase,
} from '@app/use-case/training-run-engine.use-case';
import { ApiCancelledError } from '@app/util/api-cancelled-error';
import { HttpError } from '@app/util/http-error';

/**
 * Drives one solving run, owning the queue and the grading but knowing nothing of the board.
 * A graded exercise stays up until `advance()`, so a miss can be looked at first.
 */
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

	private readonly engine = inject(TrainingRunEngineUseCase);
	private readonly sync = inject(SyncStore);

	async begin(training: TrainingRow): Promise<void> {
		patchState(this, { ...initialState, trainingUuid: training.uuid, isLoading: true });

		try {
			if ('calibrating' === training.status) {
				await this.beginCalibration(training.uuid);
			} else if (this.sync.isTreeBehind()) {
				patchState(this, { error: i18nRef(I18n.training.REPLICA_INCOMPLETE) });
			} else {
				patchState(this, { mode: 'cycle', current: await this.fetchNextSlot(training.uuid) });
			}

			patchState(this, { isLoading: false, isDone: null === this.current() });
		} catch (error) {
			this.fail(error, i18nRef(I18n.training.EXERCISE_LOAD_ERROR));
		}
	}

	/**
	 * Records how the exercise went once it is over. The verdict was settled on the first try,
	 * so this runs once per exercise and is never revised.
	 */
	async grade(record: TrainingAttemptRecord): Promise<void> {
		const uuid = this.trainingUuid();
		const current = this.current();

		if (null === uuid || null === current || null !== this.lastResult()) {
			return;
		}

		patchState(this, {
			isSubmitting: true,
			error: null,
			lastResult: record.solved ? 'solved' : 'failed',
		});

		try {
			const isClosed =
				'calibration' === this.mode()
					? await this.gradeCalibration()
					: await this.gradeCycle(uuid, current);

			patchState(this, { isSubmitting: false, isDone: isClosed });
		} catch (error) {
			this.fail(error, i18nRef(I18n.training.ATTEMPT_RECORD_ERROR));
		}
	}

	/**
	 * Opens the next round without leaving the board: a scan is one exercise, so going back to
	 * the training page between rounds would be most of the calibration.
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
		const rounds = await this.engine.listRounds(uuid);
		const last = rounds.at(-1);

		if ('pending' === last?.outcome) {
			this.openRound(last, await this.engine.listRoundPuzzles(last.uuid));

			return;
		}

		const { round, puzzles } = await this.engine.createRound(uuid);

		this.openRound(round, { total: puzzles.length, attempted: 0, puzzles });
	}

	/**
	 * A round resumed halfway is opened on the exercise it was left at, not on the first
	 * one it still has: what is left says nothing about how far in it is.
	 */
	private openRound(round: CalibrationRoundRow, dealt: RunRoundPuzzles): void {
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
	private async gradeCalibration(): Promise<boolean> {
		const round = this.round();

		if (null === round) {
			return true;
		}

		const outcome = await this.engine.submitCalibrationAttempt(round.uuid);

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

	private async gradeCycle(uuid: string, current: TrainingRunSlot): Promise<boolean> {
		if (null === current.cycleItem) {
			return true;
		}

		const cycleFinished = await this.engine.submitCycleAttempt(uuid, current.cycleItem);

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
		const slot = await this.engine.nextCycleSlot(uuid);

		return null === slot
			? null
			: { puzzle: slot.puzzle, cycleItem: slot.item, position: slot.item.position };
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
