import { Component, computed, inject, signal } from '@angular/core';

import { ChessBoardComponent } from '@app/component/chess-board/chess-board.component';
import { MoveHistoryComponent } from '@app/component/move-history/move-history.component';
import { BOARD_PRESENTER } from '@app/definition/board-presenter.interface';
import { PieceColor } from '@app/definition/chess.type';
import { ButtonDirective } from '@app/directive/button.directive';
import { InputDirective } from '@app/directive/input.directive';
import { I18n, provideI18nScope } from '@app/i18n';
import { MatchStore } from '@app/page/match/store/match.store';
import { I18nPipe } from '@app/pipe/i18n.pipe';

@Component({
	templateUrl: './match.page.html',
	styleUrl: './match.page.scss',
	imports: [ChessBoardComponent, MoveHistoryComponent, ButtonDirective, InputDirective, I18nPipe],
	providers: [
		provideI18nScope('match'),
		MatchStore,
		{ provide: BOARD_PRESENTER, useExisting: MatchStore },
	],
})
export class MatchPage {
	protected readonly I18n = I18n;

	readonly store = inject(MatchStore);

	readonly fenDraft = signal('');

	/** Headline above the board: whose turn it is, or how the game ended. */
	readonly headline = computed(() => {
		const status = this.store.status();

		if ('checkmate' === status) {
			return this.store.position().turn === this.store.playerColor()
				? I18n.match.CHECKMATE_LOST
				: I18n.match.CHECKMATE_WON;
		}

		if ('stalemate' === status) {
			return I18n.common.STALEMATE;
		}

		if ('draw' === status) {
			return I18n.common.DRAWN_POSITION;
		}

		return this.store.isPlayerTurn() ? I18n.match.YOUR_MOVE : I18n.match.MACHINE_THINKING;
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
