import { Component, ElementRef, computed, effect, inject, input } from '@angular/core';

import { PieceColor, PieceType } from '@app/definition/chess.type';

/** Where a piece came from, as a percentage of one square, plus the ply it belongs to. */
export interface PieceSlide {
	readonly x: number;
	readonly y: number;
	/** Identifies the move, so the same slide never plays twice. */
	readonly key: number;
}

const SLIDE_DURATION = 220;

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
	readonly slide = input<PieceSlide>();

	readonly maskImage = computed(() => `url(svg/chess-${this.type()}-solid.svg)`);

	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

	private animatedKey: number | undefined;

	constructor() {
		effect(() => {
			this.playSlide(this.slide());
		});
	}

	/**
	 * Slides the piece in from the square it came from. Driven by the Web Animations
	 * API rather than a CSS class, because it has to restart on every move while the
	 * element itself is reused between them.
	 */
	private playSlide(slide: PieceSlide | undefined): void {
		if (undefined === slide || slide.key === this.animatedKey) {
			return;
		}

		this.animatedKey = slide.key;

		const element = this.host.nativeElement;
		const canAnimate = 'function' === typeof (element as { animate?: unknown }).animate;

		if (!canAnimate) {
			return;
		}

		element.animate(
			[
				{ transform: `translate(${slide.x.toString()}%, ${slide.y.toString()}%)` },
				{ transform: 'none' },
			],
			{ duration: SLIDE_DURATION, easing: 'ease-out' },
		);
	}
}
