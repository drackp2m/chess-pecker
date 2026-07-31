import { Component, HostListener, OnInit, computed, effect, inject } from '@angular/core';

import { ChessBoardComponent } from '@app/component/chess-board/chess-board.component';
import { MoveHistoryComponent } from '@app/component/move-history/move-history.component';
import { BOARD_PRESENTER } from '@app/definition/board-presenter.interface';
import { PuzzleResult } from '@app/definition/puzzle.type';
import { ButtonDirective } from '@app/directive/button.directive';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library/puzzle-library.store';
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

	/**
	 * Said out loud as soon as the miss is in, so playing on never leaves any doubt
	 * about what was recorded — least of all in a calibration round.
	 */
	readonly practiceNotice = computed(() => {
		if ('failed' !== this.run.lastResult()) {
			return null;
		}

		return 'calibration' === this.run.mode()
			? 'The miss is recorded. Anything from here on is practice and does not count towards the calibration.'
			: 'The miss is recorded. Anything from here on is practice and does not change the result.';
	});

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
			this.gradeIfSettled(this.board.result());
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

	/**
	 * The board settles its verdict on the first try and keeps it, so a retry or a
	 * reveal never reaches this — the attempt is submitted exactly once.
	 */
	private gradeIfSettled(result: PuzzleResult | undefined): void {
		const slot = this.boardSlot;

		if (undefined === slot || undefined === result || this.gradedUuid === slot.puzzle.uuid) {
			return;
		}

		this.gradedUuid = slot.puzzle.uuid;
		void this.run.grade(result, this.timer.stop());
	}

	private describe(): string {
		if (this.board.isFreePlay()) {
			return 'Free play — both sides are yours, and none of it counts.';
		}

		const result = this.run.lastResult();

		if ('failed' === result) {
			return this.describeMiss();
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

	/** The exercise is graded by now, so this only says what is left to do with it. */
	private describeMiss(): string {
		if (this.board.isRevealed()) {
			return this.board.isRevealing() ? 'Missed. Watch how it went.' : 'Missed. That was the line.';
		}

		if ('solved' === this.board.outcome()) {
			return 'Missed. Found it on the retry, which leaves the attempt as it was.';
		}

		return 'Missed. It has been taken back — try it again, watch the solution, or move on.';
	}
}
