import { Component, computed, inject, signal } from '@angular/core';

import { ChessBoardComponent } from '@app/component/chess-board/chess-board.component';
import { MoveHistoryComponent } from '@app/component/move-history/move-history.component';
import { BOARD_PRESENTER } from '@app/definition/board-presenter.interface';
import { PieceColor } from '@app/definition/chess.type';
import { ButtonDirective } from '@app/directive/button.directive';
import { InputDirective } from '@app/directive/input.directive';
import { MatchStore } from '@app/page/match/store/match.store';

@Component({
	templateUrl: './match.page.html',
	styleUrl: './match.page.scss',
	imports: [ChessBoardComponent, MoveHistoryComponent, ButtonDirective, InputDirective],
	providers: [MatchStore, { provide: BOARD_PRESENTER, useExisting: MatchStore }],
})
export class MatchPage {
	readonly store = inject(MatchStore);

	readonly fenDraft = signal('');

	/** Headline above the board: whose turn it is, or how the game ended. */
	readonly headline = computed(() => {
		const status = this.store.status();

		if ('checkmate' === status) {
			return this.store.position().turn === this.store.playerColor()
				? 'Checkmate — you lost'
				: 'Checkmate — you won';
		}

		if ('stalemate' === status) {
			return 'Stalemate — it is a draw';
		}

		if ('draw' === status) {
			return 'Drawn position';
		}

		return this.store.isPlayerTurn() ? 'Your move' : 'The machine is thinking…';
	});

	readonly isCheck = computed(() => undefined !== this.store.checkedSquare());

	playAs(color: PieceColor): void {
		this.store.startMatch(color);
	}

	loadFen(): void {
		if (this.store.loadPosition(this.fenDraft().trim())) {
			this.fenDraft.set('');
		}
	}

	updateFenDraft(event: Event): void {
		this.fenDraft.set((event.target as HTMLInputElement).value);
	}
}
