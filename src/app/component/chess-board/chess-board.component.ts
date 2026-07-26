import { Component, computed, inject } from '@angular/core';

import { ChessPieceComponent } from '@app/component/chess-piece/chess-piece.component';
import { BOARD_PRESENTER } from '@app/definition/board-presenter.interface';
import { FILES, PROMOTION_PIECES, RANKS, SQUARE_COUNT } from '@app/definition/chess.constant';
import { Piece, PromotionPieceType, Square } from '@app/definition/chess.type';
import { ChessSquare } from '@app/util/chess/chess-square';

interface BoardSquare {
	readonly square: Square;
	readonly piece: Piece | undefined;
	readonly isLight: boolean;
	readonly isSelected: boolean;
	readonly isTarget: boolean;
	readonly isCapture: boolean;
	readonly isLastMove: boolean;
	readonly isChecked: boolean;
	readonly isMistake: boolean;
	readonly fileLabel: string | undefined;
	readonly rankLabel: string | undefined;
}

@Component({
	selector: 'app-chess-board',
	templateUrl: './chess-board.component.html',
	styleUrl: './chess-board.component.scss',
	imports: [ChessPieceComponent],
})
export class ChessBoardComponent {
	readonly store = inject(BOARD_PRESENTER);

	readonly promotionPieces = PROMOTION_PIECES;

	/** The 64 squares already laid out in reading order for the current orientation. */
	readonly squares = computed<BoardSquare[]>(() => {
		const isWhiteView = 'white' === this.store.orientation();
		const indexes = Array.from({ length: SQUARE_COUNT }, (_unused, order) =>
			isWhiteView ? order : SQUARE_COUNT - 1 - order,
		);

		return indexes.map((index, order) => this.describeSquare(index, order));
	});

	readonly promotionColor = computed(() => this.store.playerColor());

	select(square: BoardSquare): void {
		this.store.selectSquare(square.square);
	}

	promote(piece: PromotionPieceType): void {
		this.store.completePromotion(piece);
	}

	/** Spoken description of a square, so the board is usable without sight of it. */
	label(square: BoardSquare): string {
		if (undefined === square.piece) {
			return square.isTarget ? `Move to ${square.square}` : `Empty square ${square.square}`;
		}

		const piece = `${square.piece.color} ${square.piece.type}`;

		return square.isTarget
			? `Capture ${piece} on ${square.square}`
			: `${piece} on ${square.square}`;
	}

	private describeSquare(index: number, order: number): BoardSquare {
		const square = ChessSquare.fromIndex(index);
		const target = this.store.movesFromSelection().find((move) => square === move.to);
		const lastMove = this.store.lastMove();
		const mistake = this.store.mistake();

		return {
			square,
			piece: this.store.position().board[index],
			isLight: ChessSquare.isLight(index),
			isSelected: square === this.store.selected(),
			isTarget: undefined !== target,
			isCapture: undefined !== target?.captured,
			isLastMove: undefined !== lastMove && (square === lastMove.from || square === lastMove.to),
			isChecked: square === this.store.checkedSquare(),
			isMistake: undefined !== mistake && (square === mistake.from || square === mistake.to),
			fileLabel: 56 <= order ? FILES[ChessSquare.fileOf(index)] : undefined,
			rankLabel: 0 === order % 8 ? RANKS[ChessSquare.rowOf(index)] : undefined,
		};
	}
}
