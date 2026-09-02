import { DestroyRef, Injectable, effect, inject } from '@angular/core';
import { patchState } from '@ngrx/signals';

import { PuzzleClosure, PuzzleResult } from '@app/definition/puzzle.type';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { PuzzleRestore } from '@app/page/puzzle/store/puzzle/session';
import {
	TrainingAttemptRecord,
	TrainingRunSlot,
} from '@app/page/training/store/training-run-state';
import { TrainingRunStore } from '@app/page/training/store/training-run.store';
import { AttemptDraftRow } from '@app/repository/definition/attempt-draft-schema.interface';
import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { ActivityStore } from '@app/store/activity.store';
import { SyncStore } from '@app/store/sync.store';
import { TrainingStore } from '@app/store/training.store';
import {
	AttemptDraft,
	AttemptDraftUseCase,
	AttemptIdentity,
} from '@app/use-case/attempt-draft.use-case';
import { SolvedAttempt } from '@app/use-case/training-history.use-case';
import { PuzzleMapper } from '@app/util/puzzle-mapper';
import { SolveTimer, SolveTiming } from '@app/util/solve-timer';

interface SuspendedBoard {
	readonly restore: PuzzleRestore;
	readonly hintUnlocked: boolean;
}

@Injectable()
export class TrainingSolveSession {
	private readonly run = inject(TrainingRunStore);
	private readonly board = inject(PuzzleStore);
	private readonly training = inject(TrainingStore);
	private readonly drafts = inject(AttemptDraftUseCase);
	private readonly activity = inject(ActivityStore);
	private readonly sync = inject(SyncStore);
	private readonly timer = new SolveTimer(() => {
		void this.flush();
	});

	private slot: TrainingRunSlot | undefined;
	private gradedUuid: string | undefined;
	private draft: AttemptDraft | undefined;
	private isReviewing = false;
	private suspended: SuspendedBoard | undefined;

	constructor() {
		effect(() => {
			this.syncBoard(this.run.current());
		});

		effect(() => {
			this.submitIfClosed(this.board.closure());
		});

		effect(() => {
			if (0 < this.board.line().length) {
				void this.flush();
			}
		});

		inject(DestroyRef).onDestroy(() => {
			this.pause();
		});
	}

	/**
	 * The board outlives its page, so an exercise comes back cursor and line intact — but not
	 * mid-beat: a rewind left standing would be run again as if just asked for.
	 */
	async open(): Promise<void> {
		if (this.isReviewing) {
			this.leaveSolved();

			return;
		}

		if (undefined !== this.slot && !this.run.isDone()) {
			this.resume();
			this.board.replayLastMove();

			return;
		}

		this.discard();

		if (null === this.training.active()) {
			await this.training.load();
		}

		const active = this.training.active();

		if (null !== active) {
			await this.run.begin(active);
		}
	}

	showSolved(entry: SolvedAttempt): void {
		if (!this.isReviewing) {
			this.suspended = this.captureBoard();
			this.pause();
			this.isReviewing = true;
		}

		this.board.setPuzzles([entry.puzzle]);
		this.board.restoreFrom(this.toRestore(entry.row, entry.row.closure));
	}

	leaveSolved(): void {
		const slot = this.slot;
		const suspended = this.suspended;

		if (!this.isReviewing) {
			return;
		}

		this.isReviewing = false;
		this.suspended = undefined;

		if (undefined === slot) {
			return;
		}

		this.board.setPuzzles([PuzzleMapper.toPuzzle(slot.puzzle)]);

		if (undefined !== suspended) {
			this.board.restoreFrom(suspended.restore);
			patchState(this.board, { hintUnlocked: suspended.hintUnlocked });
		}

		this.resume();
		this.board.replayLastMove();
	}

	resume(): void {
		if (this.isReviewing) {
			return;
		}

		if (undefined !== this.slot && this.gradedUuid !== PuzzleMapper.toKey(this.slot.puzzle)) {
			this.timer.resume();
			this.board.resumeClock();
		}
	}

	pause(): void {
		this.timer.pause();
		this.board.pauseClock();

		void this.flush();
	}

	private captureBoard(): SuspendedBoard {
		return {
			hintUnlocked: this.board.hintUnlocked(),
			restore: {
				record: [...this.board.record()],
				freePlayRuns: this.board
					.freePlayRuns()
					.map((run) => ({ at: run.at, events: [...run.events] })),
				closure: this.board.closure(),
				hintUsed: this.board.hintUsed(),
				mistakeCount: this.board.mistakeCount(),
				result: this.board.result(),
			},
		};
	}

	private discard(): void {
		this.slot = undefined;
		this.gradedUuid = undefined;
		this.draft = undefined;
		this.timer.pause();
		this.run.reset();
	}

	/**
	 * Slot and board are set in one synchronous block, so the grading effect cannot pair a
	 * fresh exercise with the previous verdict.
	 */
	private syncBoard(slot: TrainingRunSlot | null): void {
		if (null === slot || this.isReviewing) {
			return;
		}

		const current = this.slot;

		if (
			undefined !== current &&
			PuzzleMapper.toKey(current.puzzle) === PuzzleMapper.toKey(slot.puzzle)
		) {
			return;
		}

		this.slot = slot;
		this.draft = undefined;
		this.board.setPuzzles([PuzzleMapper.toPuzzle(slot.puzzle)]);
		this.timer.start();

		void this.openDraft(slot, this.identify(slot));
	}

	/**
	 * Reopened on the row it left behind: the clock resumes and the board is folded back out
	 * of the record before anything is written, so a reload that touches nothing is safe.
	 */
	private async openDraft(
		slot: TrainingRunSlot,
		identity: AttemptIdentity | undefined,
	): Promise<void> {
		if (undefined === identity) {
			return;
		}

		const stored = await this.drafts.find(identity).catch(() => undefined);

		if (this.slot !== slot) {
			return;
		}

		if (undefined === stored && (await this.openClosed(slot, identity))) {
			return;
		}

		if (undefined !== stored) {
			this.timer.restore(stored.durationMs, stored.createdAt);
			this.board.restoreFrom(this.toRestore(stored, 'open'));
		}

		this.draft = {
			uuid: stored?.uuid ?? crypto.randomUUID(),
			createdAt: stored?.createdAt ?? this.timer.snapshot().createdAt,
			identity,
			...(null === slot.position ? {} : { position: slot.position }),
		};

		await this.flush();
	}

	/**
	 * A closed exercise goes back on the board to be looked at, but it is final: no draft is
	 * opened for it and nothing more is written.
	 */
	private async openClosed(slot: TrainingRunSlot, identity: AttemptIdentity): Promise<boolean> {
		const closed = await this.drafts.findClosed(identity).catch(() => undefined);

		if (this.slot !== slot || undefined === closed) {
			return false;
		}

		this.timer.restore(closed.durationMs, closed.createdAt);
		this.board.restoreFrom(this.toRestore(closed, closed.closure));

		return true;
	}

	/** The row as the board reads it, which is the record plus the verdict it was left on. */
	private toRestore(row: AttemptDraftRow | AttemptRow, closure: PuzzleClosure): PuzzleRestore {
		const solved: PuzzleResult = true === row.solved ? 'solved' : 'failed';

		return {
			record: row.record,
			freePlayRuns: row.freePlayRuns,
			closure,
			hintUsed: row.hintUsed,
			mistakeCount: row.mistakeCount,
			result: undefined === row.solved ? undefined : solved,
		};
	}

	private identify(slot: TrainingRunSlot): AttemptIdentity | undefined {
		const trainingUuid = this.run.trainingUuid();
		const kind = this.run.mode();

		if (null === trainingUuid || null === kind) {
			return undefined;
		}

		const roundUuid = this.run.round()?.uuid;

		return {
			trainingUuid,
			kind,
			puzzleUuid: PuzzleMapper.toKey(slot.puzzle),
			lichessId: slot.puzzle.lichessId,
			...(undefined === roundUuid ? {} : { roundUuid }),
			...(null === slot.cycleItem ? {} : { cycleItemUuid: slot.cycleItem.uuid }),
		};
	}

	/**
	 * The row is read synchronously, so a flush in flight while the next exercise opens still
	 * writes the clock it belongs to. A failed write is swallowed: the solve must not stop.
	 */
	private flush(): Promise<void> {
		const draft = this.draft;

		if (this.isReviewing || undefined === draft) {
			return Promise.resolve();
		}

		const { durationMs, updatedAt } = this.timer.snapshot();
		const result = this.board.result();

		return this.drafts
			.save(draft, {
				durationMs,
				updatedAt,
				record: this.board.record(),
				freePlayRuns: this.board.freePlayRuns(),
				hintUsed: this.board.hintUsed(),
				mistakeCount: this.board.mistakeCount(),
				...(undefined === result ? {} : { solved: 'solved' === result }),
			})
			.catch(() => undefined);
	}

	/**
	 * Submits when the exercise closes, not when the verdict settles: the clock runs while it
	 * is still worked on. The closure settles once, so this submits exactly once.
	 */
	private submitIfClosed(closure: PuzzleClosure): void {
		const slot = this.slot;
		const result = this.board.result();

		if ('open' === closure || this.isReviewing || undefined === slot || undefined === result) {
			return;
		}

		if (this.gradedUuid === PuzzleMapper.toKey(slot.puzzle)) {
			return;
		}

		this.gradedUuid = PuzzleMapper.toKey(slot.puzzle);

		void this.submit(closure, 'solved' === result);
	}

	/**
	 * Everything is read off the board before the first `await`: by the time the row is
	 * sealed, the game on screen may already be the next one.
	 */
	private async submit(closure: TrainingAttemptRecord['closure'], solved: boolean): Promise<void> {
		const draft = this.draft;
		const timing = this.timer.stop();
		const attempt: TrainingAttemptRecord = {
			solved,
			closure,
			hintUsed: this.board.hintUsed(),
			mistakeCount: this.board.mistakeCount(),
			record: [...this.board.record()],
			freePlayRuns: this.board
				.freePlayRuns()
				.map((run) => ({ at: run.at, events: [...run.events] })),
		};

		const flushed = this.flush();

		this.draft = undefined;

		await flushed;

		if (undefined !== draft) {
			await this.seal(draft, attempt, timing);
			void this.activity.refresh();
		}

		await this.run.grade(attempt);

		// Uploaded as soon as it is sealed: training is exactly when a device loses battery.
		void this.sync.push();
	}

	/**
	 * The draft becomes an attempt the moment the exercise closes: from here on the row is
	 * the one that uploads, and nothing else touches it.
	 */
	private async seal(
		draft: AttemptDraft,
		attempt: TrainingAttemptRecord,
		timing: SolveTiming,
	): Promise<void> {
		await this.drafts
			.seal(draft, {
				durationMs: timing.durationMs,
				updatedAt: new Date(timing.updatedAt),
				record: attempt.record,
				freePlayRuns: attempt.freePlayRuns,
				hintUsed: attempt.hintUsed,
				mistakeCount: attempt.mistakeCount,
				solved: attempt.solved,
				closure: attempt.closure,
			})
			.catch(() => undefined);
	}
}
