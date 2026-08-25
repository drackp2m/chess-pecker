import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { PuzzleDifficultyComponent } from '@app/component/puzzle-difficulty/puzzle-difficulty.component';
import { PuzzleSolverComponent } from '@app/component/puzzle-solver/puzzle-solver.component';
import { BOARD_PRESENTER } from '@app/definition/board-presenter.interface';
import { ButtonDirective } from '@app/directive/button.directive';
import { I18n, i18nRef, provideI18nScope } from '@app/i18n';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library/puzzle-library.store';
import { I18nPipe } from '@app/pipe/i18n.pipe';

const SAMPLE_CSV =
	'PuzzleId,FEN,Moves,Rating,Popularity,NbPlays,Themes,GameUrl,SelectedFor\n' +
	'JOGv3,5r2/pp6/2p3k1/2R1p2n/8/1BP5/Pr4PP/5R1K w - - 0 27,f1f8 b2b1 b3d1 b1d1 f8f1 d1f1,536,100,2178,backRankMate endgame long mate mateIn3,https://lichess.org/fFWULcre#53,500-599 / backRankMate / endgame';

@Component({
	templateUrl: './puzzle.page.html',
	styleUrl: './puzzle.page.scss',
	imports: [PuzzleDifficultyComponent, PuzzleSolverComponent, ButtonDirective, I18nPipe],
	providers: [
		provideI18nScope('puzzle'),
		PuzzleLibraryStore,
		PuzzleStore,
		{ provide: BOARD_PRESENTER, useExisting: PuzzleStore },
	],
})
export class PuzzlePage implements OnInit {
	protected readonly I18n = I18n;

	readonly store = inject(PuzzleStore);

	readonly csvDraft = signal('');

	readonly headline = computed(() => this.describe());

	readonly counter = computed(() => {
		const total = this.store.library.puzzles().length;

		return 0 === total
			? ''
			: `${(this.store.library.index() + 1).toString()} / ${total.toString()}`;
	});

	private readonly isSample = true === inject(ActivatedRoute).snapshot.data['sample'];

	/**
	 * A backgrounded tab is not an exercise being looked at, so the hint's clock stops
	 * with it — the same rule the training page's attempt duration is measured under.
	 */
	@HostListener('document:visibilitychange')
	onVisibilityChange(): void {
		if (document.hidden) {
			this.store.pauseClock();
		} else {
			this.store.resumeClock();
		}
	}

	@HostListener('window:pagehide')
	onPageHide(): void {
		this.store.pauseClock();
	}

	/** The sample route never touches the database; every other one reopens the last set. */
	ngOnInit(): void {
		if (this.isSample) {
			this.loadSample();
		} else {
			void this.store.restore();
		}
	}

	loadDraft(): void {
		if (this.store.loadCsv(this.csvDraft(), 'Pasted set')) {
			this.csvDraft.set('');
		}
	}

	/** Loads the bundled example straight onto the board. */
	loadSample(): void {
		this.store.loadCsv(SAMPLE_CSV, 'Sample exercise');
		this.csvDraft.set('');
	}

	updateDraft(event: Event): void {
		this.csvDraft.set((event.target as HTMLTextAreaElement).value);
	}

	/**
	 * `file.text()` rejects on an unreadable file, and the template calls this from `(change)`.
	 * Clearing the input is what lets the same file be picked a second time.
	 */
	async loadFile(event: Event): Promise<void> {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (undefined === file) {
			return;
		}

		try {
			this.store.loadCsv(await file.text(), file.name);
		} catch {
			this.store.library.failImport(i18nRef(I18n.puzzle.FILE_UNREADABLE, { name: file.name }));
		} finally {
			input.value = '';
		}
	}

	private describe(): string {
		if (this.store.isFreePlay()) {
			return this.describeFreePlay();
		}

		if (this.store.isRevealing()) {
			return I18n.puzzle.PLAYING_SOLUTION;
		}

		switch (this.store.outcome()) {
			case 'idle':
				return I18n.puzzle.LOAD_TO_BEGIN;
			case 'opening':
			case 'replying':
				return I18n.common.OPPONENT_MOVING;
			case 'failed':
				return I18n.puzzle.WRONG_MOVE;
			case 'solved':
				return this.describeSolved();
			case 'solving':
				return 'white' === this.store.playerColor()
					? I18n.common.FIND_MOVE_WHITE
					: I18n.common.FIND_MOVE_BLACK;
		}
	}

	/**
	 * A free-play game ends like any other, though nothing is graded and the board stays
	 * open: it is a sandbox, with nothing to lock down or record.
	 */
	private describeFreePlay(): string {
		const status = this.store.freePlayStatus();

		if ('checkmate' === status) {
			// Whoever is to move is the one who has been mated.
			return 'white' === this.store.position().turn
				? I18n.common.CHECKMATE_BLACK_WINS
				: I18n.common.CHECKMATE_WHITE_WINS;
		}

		if ('stalemate' === status) {
			return I18n.common.STALEMATE;
		}

		if ('draw' === status) {
			return I18n.common.DRAWN_POSITION;
		}

		return I18n.common.FREE_PLAY_HEADLINE;
	}

	private describeSolved(): string {
		if ('revealed' === this.store.closure()) {
			return I18n.puzzle.THAT_WAS_THE_LINE;
		}

		return 'failed' === this.store.result() ? I18n.puzzle.SOLVED_AFTER_MISS : I18n.puzzle.SOLVED;
	}
}
