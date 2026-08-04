import { DestroyRef, Injectable, effect, inject } from '@angular/core';

import { PuzzleResult } from '@app/definition/puzzle.type';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { TrainingRunSlot } from '@app/page/training/store/training-run-state';
import { TrainingRunStore } from '@app/page/training/store/training-run.store';
import { TrainingStore } from '@app/store/training.store';
import {
	AttemptDraft,
	AttemptDraftUseCase,
	AttemptIdentity,
} from '@app/use-case/attempt-draft.use-case';
import { PuzzleMapper } from '@app/util/puzzle-mapper';
import { SolveTimer } from '@app/util/solve-timer';

@Injectable()
export class TrainingSolveSession {
	private readonly run = inject(TrainingRunStore);
	private readonly board = inject(PuzzleStore);
	private readonly training = inject(TrainingStore);
	private readonly drafts = inject(AttemptDraftUseCase);
	private readonly timer = new SolveTimer(() => {
		void this.flush();
	});

	private slot: TrainingRunSlot | undefined;
	private gradedUuid: string | undefined;
	private draft: AttemptDraft | undefined;

	constructor() {
		effect(() => {
			this.syncBoard(this.run.current());
		});

		effect(() => {
			this.gradeIfSettled(this.board.result());
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

	async open(): Promise<void> {
		if (undefined !== this.slot && !this.run.isDone()) {
			this.resume();

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

	resume(): void {
		if (undefined !== this.slot && this.gradedUuid !== this.slot.puzzle.uuid) {
			this.timer.resume();
		}
	}

	pause(): void {
		this.timer.pause();

		void this.flush();
	}

	private discard(): void {
		this.slot = undefined;
		this.gradedUuid = undefined;
		this.draft = undefined;
		this.timer.pause();
		this.run.reset();
	}

	/**
	 * Both the slot and the board are set in the same synchronous block, so the grading
	 * effect can never pair a fresh exercise with the verdict of the previous one.
	 */
	private syncBoard(slot: TrainingRunSlot | null): void {
		if (null === slot || this.slot?.puzzle.uuid === slot.puzzle.uuid) {
			return;
		}

		this.slot = slot;
		this.draft = undefined;
		this.board.setPuzzles([PuzzleMapper.toPuzzle(slot.puzzle)]);
		this.timer.start();

		void this.openDraft(slot, this.identify(slot));
	}

	/**
	 * An exercise is reopened on the draft row it left behind, not from zero: without
	 * this the row would be written and then immediately overwritten with a fresh clock,
	 * which is the whole point of persisting it.
	 */
	private async openDraft(
		slot: TrainingRunSlot,
		identity: AttemptIdentity | undefined,
	): Promise<void> {
		if (undefined === identity) {
			return;
		}

		const stored = await this.drafts.find(identity).catch(() => undefined);

		if (this.slot !== slot || undefined !== stored?.solved) {
			return;
		}

		if (undefined !== stored) {
			this.timer.restore(stored.durationMs, stored.createdAt);
		}

		this.draft = {
			uuid: stored?.uuid ?? crypto.randomUUID(),
			createdAt: stored?.createdAt ?? this.timer.snapshot().createdAt,
			identity,
		};

		await this.flush();
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
			puzzleUuid: slot.puzzle.uuid,
			lichessId: slot.puzzle.lichessId,
			...(undefined === roundUuid ? {} : { roundUuid }),
			...(null === slot.cycleItemUuid ? {} : { cycleItemUuid: slot.cycleItemUuid }),
		};
	}

	/**
	 * Everything the row is composed from is read synchronously, so a flush in flight
	 * while the next exercise opens still writes the clock of the one it belongs to.
	 * A failed write is swallowed on purpose: losing the draft must not stop the solve.
	 */
	private flush(result?: PuzzleResult): Promise<void> {
		const draft = this.draft;

		if (undefined === draft) {
			return Promise.resolve();
		}

		const { durationMs, startedAt, updatedAt } = this.timer.snapshot();

		return this.drafts
			.save(draft, {
				durationMs,
				updatedAt,
				movesPlayed: this.board.line().length,
				...(undefined === startedAt ? {} : { startedAt }),
				...(undefined === result ? {} : { solved: 'solved' === result }),
			})
			.catch(() => undefined);
	}

	/**
	 * The board settles its verdict on the first try and keeps it, so a retry or a
	 * reveal never reaches this — the attempt is submitted exactly once.
	 */
	private gradeIfSettled(result: PuzzleResult | undefined): void {
		const slot = this.slot;

		if (undefined === slot || undefined === result || this.gradedUuid === slot.puzzle.uuid) {
			return;
		}

		this.gradedUuid = slot.puzzle.uuid;

		const timing = this.timer.stop();

		void this.flush(result);
		this.draft = undefined;

		void this.run.grade(result, timing);
	}
}
