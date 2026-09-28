import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { ChessBoardComponent } from '@app/component/chess-board/chess-board.component';
import { ChessPieceComponent } from '@app/component/chess-piece/chess-piece.component';
import { MoveHistoryComponent } from '@app/component/move-history/move-history.component';
import { BOARD_PRESENTER } from '@app/definition/board-presenter.interface';
import { PieceColor } from '@app/definition/chess.type';
import { MatchOpponentModel } from '@app/definition/match.type';
import { ButtonDirective } from '@app/directive/button.directive';
import { InputDirective } from '@app/directive/input.directive';
import { SelectDirective } from '@app/directive/select/select.directive';
import { I18n, provideI18nScope } from '@app/i18n';
import { MatchPersistenceService } from '@app/page/match/service/match-persistence.service';
import { STOCKFISH_ELO_LEVELS } from '@app/page/match/service/stockfish-opponent.service';
import type { StockfishElo } from '@app/page/match/service/stockfish-opponent.service';
import { MatchStore } from '@app/page/match/store/match.store';
import { I18nPipe } from '@app/pipe/i18n.pipe';

@Component({
	templateUrl: './match.page.html',
	styleUrl: './match.page.scss',
	imports: [
		ChessBoardComponent,
		ChessPieceComponent,
		MoveHistoryComponent,
		ButtonDirective,
		InputDirective,
		SelectDirective,
		I18nPipe,
	],
	providers: [
		provideI18nScope('match'),
		MatchStore,
		MatchPersistenceService,
		{ provide: BOARD_PRESENTER, useExisting: MatchStore },
	],
})
export class MatchPage implements OnInit {
	protected readonly I18n = I18n;

	readonly store = inject(MatchStore);
	readonly persistence = inject(MatchPersistenceService);
	readonly stockfishEloLevels = STOCKFISH_ELO_LEVELS;

	readonly fenDraft = signal('');

	readonly headline = computed(() => {
		if (this.store.isExploring()) {
			return I18n.common.FREE_PLAY_HEADLINE;
		}

		if (!this.store.isLive()) {
			return I18n.match.REVIEWING;
		}

		switch (this.store.status()) {
			case 'idle':
				return I18n.match.CHOOSE_SIDE;
			case 'checkmate':
				return this.store.livePosition().turn === this.store.playerColor()
					? I18n.match.CHECKMATE_LOST
					: I18n.match.CHECKMATE_WON;
			case 'stalemate':
				return I18n.common.STALEMATE;
			case 'draw':
				return I18n.common.DRAWN_POSITION;
			case 'resigned':
				return I18n.match.RESIGNED;
			case 'agreed':
				return I18n.match.DRAW_AGREED;
			case 'playing':
				return this.describePlaying();
		}
	});

	readonly isCheck = computed(() => undefined !== this.store.checkedSquare());

	ngOnInit(): void {
		void this.persistence.open();
	}

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

	selectOpponent(event: Event): void {
		this.store.setOpponentModel((event.target as HTMLSelectElement).value as MatchOpponentModel);
	}

	selectElo(event: Event): void {
		this.store.setStockfishElo(Number((event.target as HTMLSelectElement).value) as StockfishElo);
	}

	private describePlaying(): string {
		if (this.store.isDrawDeclined()) {
			return I18n.match.DRAW_DECLINED;
		}

		return this.store.isPlayerTurn() ? I18n.match.YOUR_MOVE : I18n.match.MACHINE_THINKING;
	}
}
