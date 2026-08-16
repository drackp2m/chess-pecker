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
import type { TranslationRef } from '@app/definition/i18n.type';
import { I18n, i18nRef } from '@app/i18n';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { TrainingReviewStore } from '@app/page/training/store/training-review.store';
import { TrainingRunStore } from '@app/page/training/store/training-run.store';
import { TrainingSolveSession } from '@app/page/training/store/training-solve-session';
import { I18nPipe } from '@app/pipe/i18n.pipe';

@Component({
	templateUrl: './training-solve.page.html',
	styleUrl: './training-solve.page.scss',
	imports: [PuzzleDifficultyComponent, PuzzleSolverComponent, I18nPipe],
})
export class TrainingSolvePage implements OnInit, OnDestroy {
	protected readonly I18n = I18n;

	readonly run = inject(TrainingRunStore);
	readonly board = inject(PuzzleStore);
	readonly review = inject(TrainingReviewStore);

	readonly headline = computed(() => this.describe());

	readonly nextLabel = computed(() => {
		if (this.review.isReviewing()) {
			return this.review.hasNext() ? I18n.training.NEXT_EXERCISE : I18n.training.RESUME_EXERCISE;
		}

		return !this.run.hasNext() && this.run.hasNextRound()
			? I18n.training.NEXT_ROUND
			: I18n.training.NEXT_EXERCISE;
	});

	readonly isNextDisabled = computed(
		() =>
			!this.review.isReviewing() &&
			(this.run.isBusy() || (!this.run.hasNext() && !this.run.hasNextRound())),
	);

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
			? I18n.training.PRACTICE_NOTICE_CALIBRATION
			: I18n.training.PRACTICE_NOTICE_CYCLE;
	});

	readonly label = computed<TranslationRef>(() => {
		const round = this.run.round();
		const position = this.run.current()?.position;

		if (null !== round) {
			return this.describeRound(round.index, round.rating);
		}

		return null === position || undefined === position
			? i18nRef(I18n.training.CYCLE_LABEL)
			: i18nRef(I18n.training.CYCLE_LABEL_POSITION, { position: position + 1 });
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
		this.review.leave();
		void this.session.open();
	}

	ngOnDestroy(): void {
		this.session.pause();
	}

	previous(): void {
		const entry = this.review.previous();

		if (null !== entry) {
			this.session.showSolved(entry);
		}
	}

	next(): void {
		if (this.review.isReviewing()) {
			const entry = this.review.forward();

			if (null === entry) {
				this.session.leaveSolved();
			} else {
				this.session.showSolved(entry);
			}

			return;
		}

		if (this.run.hasNext()) {
			this.run.advance();

			return;
		}

		void this.run.openNextRound();
	}

	private describe(): string {
		if (this.board.isFreePlay()) {
			return I18n.common.FREE_PLAY_HEADLINE;
		}

		if (!this.board.isOpen()) {
			return this.describeClosed();
		}

		switch (this.board.outcome()) {
			case 'idle':
				return I18n.training.LOADING_EXERCISE;
			case 'opening':
			case 'replying':
				return I18n.common.OPPONENT_MOVING;
			case 'failed':
				return I18n.training.NOPE;
			case 'solving':
				return this.describeSolving();
			case 'solved':
				return I18n.training.RECORDING_ATTEMPT;
		}
	}

	/** The exercise is over, so this only says how it ended. */
	private describeClosed(): string {
		if ('revealed' === this.board.closure()) {
			return this.board.isRevealing() ? I18n.training.GAVE_UP_WATCHING : I18n.training.GAVE_UP_LINE;
		}

		return 'failed' === this.board.result() ? I18n.training.FOUND_AFTER_MISS : I18n.training.SOLVED;
	}

	/**
	 * The note is sealed on the first try, so a miss is said out loud straight away —
	 * but the exercise goes on until the line is found or handed over.
	 */
	private describeSolving(): string {
		// ToDo => why "is Practice" is true when make a mistake?
		if (this.board.isPractice()) {
			return I18n.training.MISSED_RETRY;
		}

		return 'white' === this.board.playerColor()
			? I18n.common.FIND_MOVE_WHITE
			: I18n.common.FIND_MOVE_BLACK;
	}

	private describeRound(round: number, rating: number): TranslationRef {
		const position = this.run.roundPosition();
		const total = this.run.roundTotal();

		return null === position || null === total
			? i18nRef(I18n.training.CALIBRATION_LABEL, { round, rating })
			: i18nRef(I18n.training.CALIBRATION_LABEL_PROGRESS, { round, rating, position, total });
	}
}
