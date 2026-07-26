import { InjectionToken, Signal } from '@angular/core';

import {
	ChessMove,
	ChessMoveRecord,
	ChessPosition,
	PieceColor,
	PromotionPieceType,
	Square,
} from '@app/definition/chess.type';

export interface PendingPromotion {
	readonly from: Square;
	readonly to: Square;
}

/**
 * Everything the board needs in order to draw itself and report clicks. Both the
 * free-play match and the puzzle trainer implement it, so the board component stays
 * unaware of which mode is driving it.
 */
export interface BoardPresenter {
	readonly position: Signal<ChessPosition>;
	readonly orientation: Signal<PieceColor>;
	readonly playerColor: Signal<PieceColor>;
	readonly selected: Signal<Square | undefined>;
	readonly movesFromSelection: Signal<readonly ChessMove[]>;
	readonly history: Signal<readonly ChessMoveRecord[]>;
	readonly lastMove: Signal<ChessMove | undefined>;
	/** A refuted move, highlighted in red until it is taken back. */
	readonly mistake: Signal<ChessMove | undefined>;
	readonly checkedSquare: Signal<Square | undefined>;
	readonly pendingPromotion: Signal<PendingPromotion | undefined>;
	/** Something is being played for you; the board shows a waiting cursor. */
	readonly isBusy: Signal<boolean>;
	/** The board refuses input entirely (game over, or nothing loaded). */
	readonly isLocked: Signal<boolean>;

	selectSquare(square: Square): void;
	completePromotion(piece: PromotionPieceType): void;
	cancelPromotion(): void;
}

export const BOARD_PRESENTER = new InjectionToken<BoardPresenter>('BOARD_PRESENTER');
