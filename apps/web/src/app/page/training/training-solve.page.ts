import { Component, HostListener, OnInit, computed, effect, inject } from '@angular/core';

import { ChessBoardComponent } from '@app/component/chess-board/chess-board.component';
import { MoveHistoryComponent } from '@app/component/move-history/move-history.component';
import { BOARD_PRESENTER } from '@app/definition/board-presenter.interface';
import { PuzzleOutcome } from '@app/definition/puzzle.type';
import { ButtonDirective } from '@app/directive/button.directive';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library.store';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle.store';
import { TrainingRunSlot } from '@app/page/training/store/training-run-state';
import { TrainingRunStore } from '@app/page/training/store/training-run.store';
import { TrainingStore } from '@app/store/training.store';
import { PuzzleMapper } from '@app/util/puzzle-mapper';
import { SolveTimer } from '@app/util/solve-timer';

@Component({
	templateUrl: './training-solve.page.html',
	styleUrl: './training-solve.page.scss',
	imports: [ChessBoardComponent, MoveHistoryComponent, ButtonDirective, RouterLinkDirective],
	providers: [
		PuzzleLibraryStore,
		PuzzleStore,
		TrainingRunStore,
		{ provide: BOARD_PRESENTER, useExisting: PuzzleStore },
	],
})
// ToDo => a miss is marked and left behind, but the solution is never shown, and the
// method asks for it: seeing the right move is the part that teaches, even though it
// does not change the recorded result. The line is already in `puzzle.moves`, so it is
// a matter of replaying it on the board once the attempt has been submitted.
//
// FixMe => leaving the page mid-exercise drops the attempt: the store is provided by
// this component, so the accumulated time and the fact that it was ever opened die with
// it, and the exercise comes back untouched with the clock at zero. Same hole
// `PuzzleStore` already documents; here it is worse, because the time is what the whole
// method is scored on.
export class TrainingSolvePage implements OnInit {
	readonly run = inject(TrainingRunStore);
	readonly board = inject(PuzzleStore);
	readonly training = inject(TrainingStore);

	readonly headline = computed(() => this.describe());

	readonly label = computed(() => {
		const round = this.run.round();
		const position = this.run.current()?.position;

		if (null !== round) {
			const roundPosition = this.run.roundPosition();
			const roundTotal = this.run.roundTotal();
			const progress =
				null === roundPosition || null === roundTotal
					? ''
					: ` (${roundPosition.toString()} / ${roundTotal.toString()})`;

			return `Calibration · round ${round.index.toString()}${progress} · ELO ${round.rating.toString()}`;
		}

		return null === position || undefined === position
			? 'Cycle'
			: `Cycle · exercise ${(position + 1).toString()}`;
	});

	private readonly timer = new SolveTimer();

	/** The exercise the board is showing, kept in step with the run's `current`. */
	private boardSlot: TrainingRunSlot | undefined;
	private gradedUuid: string | undefined;

	constructor() {
		effect(() => {
			this.syncBoard(this.run.current());
		});

		effect(() => {
			this.gradeIfSettled(this.board.outcome());
		});
	}

	/** A backgrounded tab must not inflate the exercise's recorded duration. */
	@HostListener('document:visibilitychange')
	onVisibilityChange(): void {
		if (document.hidden) {
			this.timer.pause();
		} else {
			this.timer.resume();
		}
	}

	ngOnInit(): void {
		void this.begin();
	}

	next(): void {
		this.run.advance();
	}

	private async begin(): Promise<void> {
		if (null === this.training.active()) {
			await this.training.load();
		}

		const active = this.training.active();

		if (null !== active) {
			await this.run.begin(active);
		}
	}

	/**
	 * Both the slot and the board are set in the same synchronous block, so the grading
	 * effect can never pair a fresh exercise with the verdict of the previous one.
	 */
	private syncBoard(slot: TrainingRunSlot | null): void {
		if (null === slot || this.boardSlot?.puzzle.uuid === slot.puzzle.uuid) {
			return;
		}

		this.boardSlot = slot;
		this.board.setPuzzles([PuzzleMapper.toPuzzle(slot.puzzle)]);
		this.timer.start();
	}

	private gradeIfSettled(outcome: PuzzleOutcome): void {
		const slot = this.boardSlot;

		if (undefined === slot || this.gradedUuid === slot.puzzle.uuid) {
			return;
		}

		if ('solved' !== outcome && 'failed' !== outcome) {
			return;
		}

		this.gradedUuid = slot.puzzle.uuid;
		void this.run.grade(outcome, this.timer.stop());
	}

	private describe(): string {
		const result = this.run.lastResult();

		if ('failed' === result) {
			return 'Missed. No retry — step back to walk the line, then move on.';
		}

		if ('solved' === result) {
			return 'Solved.';
		}

		switch (this.board.outcome()) {
			case 'idle':
				return 'Loading the exercise…';
			case 'opening':
			case 'replying':
				return 'Opponent is moving…';
			case 'solving':
				return `Find the move for ${this.board.playerColor()}`;
			case 'failed':
			case 'solved':
				return 'Recording the attempt…';
		}
	}
}
