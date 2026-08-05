import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { PuzzleDifficultyComponent } from '@app/component/puzzle-difficulty/puzzle-difficulty.component';
import { PuzzleSolverComponent } from '@app/component/puzzle-solver/puzzle-solver.component';
import { BOARD_PRESENTER } from '@app/definition/board-presenter.interface';
import { ButtonDirective } from '@app/directive/button.directive';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library/puzzle-library.store';

const SAMPLE_CSV =
	'PuzzleId,FEN,Moves,Rating,Popularity,NbPlays,Themes,GameUrl,SelectedFor\n' +
	'JOGv3,5r2/pp6/2p3k1/2R1p2n/8/1BP5/Pr4PP/5R1K w - - 0 27,f1f8 b2b1 b3d1 b1d1 f8f1 d1f1,536,100,2178,backRankMate endgame long mate mateIn3,https://lichess.org/fFWULcre#53,500-599 / backRankMate / endgame';

@Component({
	templateUrl: './puzzle.page.html',
	styleUrl: './puzzle.page.scss',
	imports: [PuzzleDifficultyComponent, PuzzleSolverComponent, ButtonDirective],
	providers: [
		PuzzleLibraryStore,
		PuzzleStore,
		{ provide: BOARD_PRESENTER, useExisting: PuzzleStore },
	],
})
export class PuzzlePage implements OnInit {
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
	 * `file.text()` rejects on an unreadable file — removed from disk, permission
	 * denied — and the template calls this straight from `(change)`, so the rejection
	 * has to be handled here. Clearing the input is what lets the same file be picked
	 * again: without it the value never changes and no further `change` event fires.
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
			this.store.library.failImport(`Could not read ${file.name}.`);
		} finally {
			input.value = '';
		}
	}

	private describe(): string {
		if (this.store.isFreePlay()) {
			return this.describeFreePlay();
		}

		if (this.store.isRevealing()) {
			return 'Playing the solution…';
		}

		switch (this.store.outcome()) {
			case 'idle':
				return 'Load a set of exercises to begin';
			case 'opening':
			case 'replying':
				return 'Opponent is moving…';
			case 'failed':
				return 'Not the move — taking it back so you can try again';
			case 'solved':
				return this.describeSolved();
			case 'solving':
				return `Find the move for ${this.store.playerColor()}`;
		}
	}

	/**
	 * A free-play game ends the way any game ends, even though nothing here is graded
	 * and the board stays open afterwards: it is a sandbox, and there is nothing to
	 * lock down or record.
	 */
	private describeFreePlay(): string {
		const status = this.store.freePlayStatus();

		if ('checkmate' === status) {
			// Whoever is to move is the one who has been mated.
			return `Checkmate — ${'white' === this.store.position().turn ? 'black' : 'white'} wins`;
		}

		if ('stalemate' === status) {
			return 'Stalemate — it is a draw';
		}

		if ('draw' === status) {
			return 'Drawn position';
		}

		return 'Free play — both sides are yours.';
	}

	private describeSolved(): string {
		if ('revealed' === this.store.closure()) {
			return 'That was the line';
		}

		return 'failed' === this.store.result() ? 'Solved, after the miss' : 'Solved';
	}
}
