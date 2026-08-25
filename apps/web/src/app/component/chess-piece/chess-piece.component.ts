import { Component, ElementRef, computed, effect, inject, input } from '@angular/core';

import { PIECE_SHAPE } from '@app/definition/chess-piece.constant';
import { PieceColor, PieceType } from '@app/definition/chess.type';
import { SLIDE_DURATION, scaleForSpeed } from '@app/definition/move-speed.type';
import { BoardPreferenceService } from '@app/service/board-preference.service';

/** Where a piece came from, as a percentage of one square, plus the ply it belongs to. */
export interface PieceSlide {
	readonly x: number;
	readonly y: number;
	/** Identifies the move, so the same slide never plays twice. */
	readonly key: number;
}

/**
 * Draws one piece from the artwork's own outlines, filled and stroked with the board
 * colours, which keeps the piece readable on any square and in any theme.
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

	readonly shapes = computed(() => PIECE_SHAPE[this.type()]);

	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

	private readonly speed = inject(BoardPreferenceService).moveSpeed;

	private animatedKey: number | undefined;

	private animatedPiece: string | undefined;

	private running: Animation | undefined;

	constructor() {
		effect(() => {
			this.playSlide(this.slide(), `${this.color()} ${this.type()}`);
		});
	}

	/**
	 * Slides the piece in from where it came, through the Web Animations API because the
	 * element is reused between moves. That reuse is why a slide is called off, not left.
	 */
	private playSlide(slide: PieceSlide | undefined, piece: string): void {
		if (undefined === slide || piece !== this.animatedPiece) {
			this.stopSlide();
		}

		if (undefined === slide || slide.key === this.animatedKey) {
			return;
		}

		this.animatedKey = slide.key;
		this.animatedPiece = piece;

		const element = this.host.nativeElement;
		const canAnimate = 'function' === typeof (element as { animate?: unknown }).animate;

		if (!canAnimate) {
			return;
		}

		this.running = element.animate(
			[
				{ transform: `translate(${slide.x.toString()}%, ${slide.y.toString()}%)` },
				{ transform: 'none' },
			],
			{ duration: scaleForSpeed(SLIDE_DURATION, this.speed()), easing: 'ease-out' },
		);
	}

	/** The key is deliberately kept: a journey called off is still one already run. */
	private stopSlide(): void {
		this.running?.cancel();
		this.running = undefined;
	}
}
