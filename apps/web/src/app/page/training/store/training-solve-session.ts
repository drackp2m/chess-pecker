import { Injectable, effect, inject } from '@angular/core';

import { PuzzleResult } from '@app/definition/puzzle.type';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { TrainingRunSlot } from '@app/page/training/store/training-run-state';
import { TrainingRunStore } from '@app/page/training/store/training-run.store';
import { TrainingStore } from '@app/store/training.store';
import { PuzzleMapper } from '@app/util/puzzle-mapper';
import { SolveTimer } from '@app/util/solve-timer';

@Injectable()
export class TrainingSolveSession {
	private readonly run = inject(TrainingRunStore);
	private readonly board = inject(PuzzleStore);
	private readonly training = inject(TrainingStore);
	private readonly timer = new SolveTimer();

	private slot: TrainingRunSlot | undefined;
	private gradedUuid: string | undefined;

	constructor() {
		effect(() => {
			this.syncBoard(this.run.current());
		});

		effect(() => {
			this.gradeIfSettled(this.board.result());
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
	}

	private discard(): void {
		this.slot = undefined;
		this.gradedUuid = undefined;
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
		this.board.setPuzzles([PuzzleMapper.toPuzzle(slot.puzzle)]);
		this.timer.start();
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
		void this.run.grade(result, this.timer.stop());
	}
}
