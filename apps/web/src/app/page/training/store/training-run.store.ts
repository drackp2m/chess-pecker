import { HttpStatusCode } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';
import { patchState, signalStore, withState } from '@ngrx/signals';

import { ApiPuzzle, CalibrationRound, Training } from '@app/definition/training.interface';
import {
	TrainingRunResult,
	TrainingRunSlot,
	describeOutcome,
	initialState,
	toSlot,
} from '@app/page/training/store/training-run-state';
import { PuzzleCatalogRepository } from '@app/repository/puzzle-catalog.repository';
import { TrainingRunRepository } from '@app/repository/training-run.repository';
import { HttpError } from '@app/util/http-error';

const RATING_BAND_WIDTH = 100;
const MAX_ROUND_PUZZLES = 10;

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
//
// ToDo => none of the 412s the API can answer with are told apart from a generic
// failure, and they mean very different things to the user: "not enough puzzles" is an
// empty catalog and needs `POST /puzzle/import` run by an admin, "already in progress"
// means the training list is stale, "goal is required" is a step skipped in the UI.
@Injectable()
export class TrainingRunStore extends signalStore(
	{ protectedState: false },
	withState(initialState),
) {
	readonly isBusy = computed(() => this.isLoading() || this.isSubmitting());
	readonly hasNext = computed(() => null !== this.pending());

	private readonly runRepository = inject(TrainingRunRepository);
	private readonly catalogRepository = inject(PuzzleCatalogRepository);

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
			this.fail(error, 'The exercise could not be loaded.');
		}
	}

	/**
	 * Records how the exercise on screen went. Woodpecker grades on the first try, so
	 * this runs once per exercise and is never revised.
	 */
	async grade(result: TrainingRunResult, durationMs: number): Promise<void> {
		const uuid = this.trainingUuid();
		const current = this.current();

		if (null === uuid || null === current || null !== this.lastResult()) {
			return;
		}

		patchState(this, { isSubmitting: true, error: null, lastResult: result });

		try {
			const isClosed =
				'calibration' === this.mode()
					? await this.gradeCalibration(uuid, current.puzzle, result, durationMs)
					: await this.gradeCycle(uuid, current, result, durationMs);

			patchState(this, { isSubmitting: false, isDone: isClosed });
		} catch (error) {
			this.fail(error, 'The attempt could not be recorded.');
		}
	}

	/** Moves on to the exercise fetched while the graded one was still on screen. */
	advance(): void {
		const pending = this.pending();

		if (null === pending) {
			return;
		}

		patchState(this, { current: pending, pending: null, lastResult: null, notice: null });
	}

	/**
	 * A round left open cannot be handed its exercises back — it records the band it
	 * probed, not which ones it dealt — so resuming draws a fresh batch from the same
	 * band and submits until the API reports the round closed.
	 */
	// FixMe => that redraw is a workaround, and it shows: the fresh batch can repeat an
	// exercise the round already asked (inflating the accuracy the band is judged on),
	// and the client cannot tell how many attempts are still missing, so it fetches ten
	// and hopes. The round has to remember what it dealt — a `training_calibration_puzzle`
	// row per exercise, or reuse `training_puzzle` — and the create endpoint has to hand
	// back the open round with its remaining exercises instead of answering 412.
	private async beginCalibration(uuid: string): Promise<void> {
		const rounds = await this.runRepository.listRounds(uuid);
		const last = rounds.at(-1);

		if ('pending' === last?.outcome) {
			const puzzles = await this.catalogRepository.searchByRating(
				last.rating,
				last.rating + RATING_BAND_WIDTH - 1,
				MAX_ROUND_PUZZLES,
			);

			this.openRound(last, puzzles);

			return;
		}

		const { round, puzzles } = await this.runRepository.createRound(uuid);

		this.openRound(round, puzzles);
	}

	private openRound(round: CalibrationRound, puzzles: readonly ApiPuzzle[]): void {
		const [first, ...rest] = puzzles;

		patchState(this, {
			mode: 'calibration',
			round,
			current: undefined === first ? null : toSlot(first),
			queue: rest,
			notice: undefined === first ? 'The catalog has no exercises in that rating band.' : null,
		});
	}

	/** Reports whether the run is over, either because the round closed or it ran dry. */
	private async gradeCalibration(
		uuid: string,
		puzzle: ApiPuzzle,
		result: TrainingRunResult,
		durationMs: number,
	): Promise<boolean> {
		const round = this.round();

		if (null === round) {
			return true;
		}

		const { outcome } = await this.runRepository.submitCalibrationAttempt(uuid, {
			roundUuid: round.uuid,
			puzzleUuid: puzzle.uuid,
			durationMs,
			solved: 'solved' === result,
		});

		if ('pending' !== outcome) {
			patchState(this, { queue: [], notice: describeOutcome(outcome) });

			return true;
		}

		const [next, ...rest] = this.queue();

		patchState(this, {
			pending: undefined === next ? null : toSlot(next),
			queue: rest,
			notice: undefined === next ? 'The round ran out of exercises. Open it again.' : null,
		});

		return undefined === next;
	}

	private async gradeCycle(
		uuid: string,
		current: TrainingRunSlot,
		result: TrainingRunResult,
		durationMs: number,
	): Promise<boolean> {
		if (null === current.cycleItemUuid) {
			return true;
		}

		const { cycleFinished } = await this.runRepository.submitCycleAttempt(uuid, {
			cycleItemUuid: current.cycleItemUuid,
			durationMs,
			solved: 'solved' === result,
		});

		if (cycleFinished) {
			patchState(this, { notice: 'Cycle complete.' });

			return true;
		}

		const next = await this.fetchNextSlot(uuid);

		patchState(this, { pending: next, notice: null === next ? 'Cycle complete.' : null });

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

	private fail(error: unknown, fallback: string): void {
		patchState(this, {
			isLoading: false,
			isSubmitting: false,
			isDone: true,
			error: HttpError.toMessage(error, fallback),
		});
	}
}
