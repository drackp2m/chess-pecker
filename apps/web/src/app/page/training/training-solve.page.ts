import {
	Component,
	HostListener,
	OnDestroy,
	OnInit,
	computed,
	effect,
	inject,
} from '@angular/core';
import { Router } from '@angular/router';

import { ChessBoardComponent } from '@app/component/chess-board/chess-board.component';
import { MoveHistoryComponent } from '@app/component/move-history/move-history.component';
import { ButtonDirective } from '@app/directive/button.directive';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { TrainingRunStore } from '@app/page/training/store/training-run.store';
import { TrainingSolveSession } from '@app/page/training/store/training-solve-session';

@Component({
	templateUrl: './training-solve.page.html',
	styleUrl: './training-solve.page.scss',
	imports: [ChessBoardComponent, MoveHistoryComponent, ButtonDirective, RouterLinkDirective],
})
export class TrainingSolvePage implements OnInit, OnDestroy {
	readonly run = inject(TrainingRunStore);
	readonly board = inject(PuzzleStore);

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

	private readonly router = inject(Router);
	private readonly session = inject(TrainingSolveSession);

	constructor() {
		// The calibration is over the moment a band is accepted, and what it was for is the
		// set and the pace, which are asked for back on the training page.
		effect(() => {
			if (this.run.isCalibrated()) {
				void this.router.navigate(['/training']);
			}
		});
	}

	/** A backgrounded tab must not inflate the exercise's recorded duration. */
	@HostListener('document:visibilitychange')
	onVisibilityChange(): void {
		if (document.hidden) {
			this.session.pause();
		} else {
			this.session.resume();
		}
	}

	ngOnInit(): void {
		void this.session.open();
	}

	ngOnDestroy(): void {
		this.session.pause();
	}

	next(): void {
		this.run.advance();
	}

	nextRound(): void {
		void this.run.openNextRound();
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
