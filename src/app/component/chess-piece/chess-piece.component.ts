import { Component, computed, input } from '@angular/core';

import { PieceColor, PieceType } from '@app/definition/chess.type';

/**
 * Draws one piece by masking a flat colour with the silhouette extracted from the
 * sprite, which keeps the piece readable on any square and in any theme.
 */
@Component({
	selector: 'app-chess-piece',
	templateUrl: './chess-piece.component.html',
	styleUrl: './chess-piece.component.scss',
	host: {
		'[class.white]': "'white' === color()",
		'[class.black]': "'black' === color()",
	},
})
export class ChessPieceComponent {
	readonly type = input.required<PieceType>();
	readonly color = input.required<PieceColor>();

	readonly maskImage = computed(() => `url(svg/chess-${this.type()}-solid.svg)`);
}
