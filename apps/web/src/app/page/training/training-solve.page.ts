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

import { PuzzleDifficultyComponent } from '@app/component/puzzle-difficulty/puzzle-difficulty.component';
import { PuzzleSolverComponent } from '@app/component/puzzle-solver/puzzle-solver.component';
import { ButtonDirective } from '@app/directive/button.directive';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { TrainingRunStore } from '@app/page/training/store/training-run.store';
import { TrainingSolveSession } from '@app/page/training/store/training-solve-session';

@Component({
	templateUrl: './training-solve.page.html',
	styleUrl: './training-solve.page.scss',
	imports: [PuzzleDifficultyComponent, PuzzleSolverComponent, ButtonDirective, RouterLinkDirective],
})
export class TrainingSolvePage implements OnInit, OnDestroy {
	readonly run = inject(TrainingRunStore);
	readonly board = inject(PuzzleStore);

	readonly headline = computed(() => this.describe());

	/**
	 * Said out loud as soon as the miss is in — which is where the note is sealed, long
	 * before the exercise is over — so playing on never leaves any doubt about what will
	 * be recorded, least of all in a calibration round.
	 */
	readonly practiceNotice = computed(() => {
		if (!this.board.isPractice()) {
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

	/**
	 * The partner of `visibilitychange` and the last thing a page is guaranteed on
	 * mobile, where `beforeunload` often never fires at all.
	 */
	@HostListener('window:pagehide')
	onPageHide(): void {
		this.session.pause();
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

		if (!this.board.isOpen()) {
			return this.describeClosed();
		}

		switch (this.board.outcome()) {
			case 'idle':
				return 'Loading the exercise…';
			case 'opening':
			case 'replying':
				return 'Opponent is moving…';
			case 'failed':
				return 'Not the move. It is taken back on its own — try it again.';
			case 'solving':
				return this.describeSolving();
			case 'solved':
				return 'Recording the attempt…';
		}
	}

	/** The exercise is over, so this only says how it ended. */
	private describeClosed(): string {
		if ('revealed' === this.board.closure()) {
			return this.board.isRevealing()
				? 'Gave up. Watch how it went.'
				: 'Gave up. That was the line.';
		}

		return 'failed' === this.board.result()
			? 'Found it, after the miss, which leaves the attempt as it was.'
			: 'Solved.';
	}

	/**
	 * The note is sealed on the first try, so a miss is said out loud straight away —
	 * but the exercise goes on until the line is found or handed over.
	 */
	private describeSolving(): string {
		if (this.board.isPractice()) {
			return 'Missed. Try it again, or give up to see the line.';
		}

		return `Find the move for ${this.board.playerColor()}`;
	}
}
