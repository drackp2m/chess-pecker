import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { ChessBoardComponent } from '@app/component/chess-board/chess-board.component';
import { MoveHistoryComponent } from '@app/component/move-history/move-history.component';
import { BOARD_PRESENTER } from '@app/definition/board-presenter.interface';
import { ButtonDirective } from '@app/directive/button.directive';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library.store';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle.store';

const SAMPLE_CSV =
	'PuzzleId,FEN,Moves,Rating,Popularity,NbPlays,Themes,GameUrl,SelectedFor\n' +
	'JOGv3,5r2/pp6/2p3k1/2R1p2n/8/1BP5/Pr4PP/5R1K w - - 0 27,f1f8 b2b1 b3d1 b1d1 f8f1 d1f1,536,100,2178,backRankMate endgame long mate mateIn3,https://lichess.org/fFWULcre#53,500-599 / backRankMate / endgame';

@Component({
	templateUrl: './puzzle.page.html',
	styleUrl: './puzzle.page.scss',
	imports: [ChessBoardComponent, MoveHistoryComponent, ButtonDirective],
	providers: [
		PuzzleLibraryStore,
		PuzzleStore,
		{ provide: BOARD_PRESENTER, useExisting: PuzzleStore },
	],
})
export class PuzzlePage {
	readonly store = inject(PuzzleStore);

	readonly csvDraft = signal('');

	readonly headline = computed(() => {
		switch (this.store.outcome()) {
			case 'idle':
				return 'Load a set of exercises to begin';
			case 'opening':
			case 'replying':
				return 'Opponent is moving…';
			case 'failed':
				return 'Not the move — play it out, or step back to try again';
			case 'solved':
				return 'Solved';
			case 'solving':
				return `Find the move for ${this.store.playerColor()}`;
		}
	});

	readonly counter = computed(() => {
		const total = this.store.library.puzzles().length;

		return 0 === total
			? ''
			: `${(this.store.library.index() + 1).toString()} / ${total.toString()}`;
	});

	constructor() {
		const isSample: unknown = inject(ActivatedRoute).snapshot.data['sample'];

		if (true === isSample) {
			this.loadSample();
		}
	}

	loadDraft(): void {
		if (this.store.loadCsv(this.csvDraft())) {
			this.csvDraft.set('');
		}
	}

	/** Loads the bundled example straight onto the board. */
	loadSample(): void {
		this.store.loadCsv(SAMPLE_CSV);
		this.csvDraft.set('');
	}

	updateDraft(event: Event): void {
		this.csvDraft.set((event.target as HTMLTextAreaElement).value);
	}

	async loadFile(event: Event): Promise<void> {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];

		if (undefined === file) {
			return;
		}

		this.store.loadCsv(await file.text());
		input.value = '';
	}
}
