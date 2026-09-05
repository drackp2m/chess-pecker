import { Component, computed, input } from '@angular/core';

import { ChessPieceComponent } from '@app/component/chess-piece/chess-piece.component';
import { SQUARE_COUNT } from '@app/definition/chess.constant';
import type { ChessMove, ChessPosition, Piece } from '@app/definition/chess.type';
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

	readonly squares = computed<StaticSquare[]>(() => {
		const position = this.position();
		const move = this.move();

		return Array.from({ length: SQUARE_COUNT }, (_unused, index) => {
			const square = ChessSquare.fromIndex(index);

			return {
				piece: position?.board[index],
				isLight: ChessSquare.isLight(index),
				isFrom: square === move?.from,
				isTo: square === move?.to,
			};
		});
	});
}
