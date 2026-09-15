import { Component, computed, input } from '@angular/core';

import { indexAtOrder } from '@app/component/chess-board/board-geometry';
import { ChessPieceComponent } from '@app/component/chess-piece/chess-piece.component';
import { SQUARE_COUNT } from '@app/definition/chess.constant';
import type { ChessMove, ChessPosition, Piece, PieceColor } from '@app/definition/chess.type';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessNotation } from '@app/util/chess/chess-notation';
import { ChessSquare } from '@app/util/chess/chess-square';

interface StaticSquare {
	readonly piece: Piece | undefined;
	readonly isLight: boolean;
	readonly isFrom: boolean;
	readonly isTo: boolean;
}

@Component({
	selector: 'app-static-chess-board',
	templateUrl: './static-chess-board.component.html',
	styleUrl: './static-chess-board.component.scss',
	imports: [ChessPieceComponent],
})
export class StaticChessBoardComponent {
	readonly fen = input.required<string>();
	readonly firstMove = input.required<string | undefined>();

	readonly position = computed<ChessPosition | undefined>(() => {
		try {
			return ChessFen.parse(this.fen());
		} catch {
			return undefined;
		}
	});

	readonly move = computed<ChessMove | undefined>(() => {
		const position = this.position();
		const firstMove = this.firstMove();

		return undefined === position || undefined === firstMove
			? undefined
			: ChessNotation.parse(position, firstMove);
	});

	readonly orientation = computed<PieceColor>(() => {
		const position = this.position();

		return 'black' !== position?.turn ? 'black' : 'white';
	});

	readonly squares = computed<StaticSquare[]>(() => {
		const position = this.position();
		const move = this.move();
		const orientation = this.orientation();

		return Array.from({ length: SQUARE_COUNT }, (_unused, index) => {
			const square = ChessSquare.fromIndex(indexAtOrder(index, orientation));
			const squareIndex = ChessSquare.toIndex(square);

			return {
				piece: position?.board[squareIndex],
				isLight: ChessSquare.isLight(squareIndex),
				isFrom: square === move?.from,
				isTo: square === move?.to,
			};
		});
	});
}
