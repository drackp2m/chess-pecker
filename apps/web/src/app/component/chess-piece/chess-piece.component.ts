import { Component, ElementRef, computed, effect, inject, input } from '@angular/core';

import { PIECE_SHAPE } from '@app/definition/chess-piece.constant';
import { PieceColor, PieceType } from '@app/definition/chess.type';
import { SLIDE_DURATION, scaleForSpeed } from '@app/definition/move-speed.type';
import {
	LIFT_DURATION,
	LIFT_FLAT,
	LIFT_SCALE,
	LIFT_SHADOW,
	LIFT_SHARE,
} from '@app/definition/piece-lift.constant';
import { BoardPreferenceService } from '@app/service/board-preference.service';

export type PieceFlight = 'flown' | 'lifted' | 'drop' | 'placed';

/** Where a piece came from, as a percentage of one square, plus the ply it belongs to. */
export interface PieceSlide {
	readonly x: number;
	readonly y: number;
	/** Identifies the move, so the same slide never plays twice. */
	readonly key: number;
	readonly flight?: PieceFlight;
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

		const travel = scaleForSpeed(SLIDE_DURATION, this.speed());

		this.running = element.animate(keyframesFor(slide, travel), timingFor(slide, travel));
	}

	/** The key is deliberately kept: a journey called off is still one already run. */
	private stopSlide(): void {
		this.running?.cancel();
		this.running = undefined;
	}
}

function travelOf(slide: PieceSlide): string {
	return `translate(${slide.x.toString()}%, ${slide.y.toString()}%)`;
}

const RAISED = LIFT_SCALE.toString();
const FLAT = '1';

/**
 * The journey itself is only ever given at its two ends, so it keeps the single ease-out it
 * has always run on however many frames the rise and the fall need in between.
 */
function keyframesFor(slide: PieceSlide, travel: number): Keyframe[] {
	const from = travelOf(slide);

	if (undefined === slide.flight || 'placed' === slide.flight) {
		return [{ transform: from }, { transform: 'none' }];
	}

	if ('drop' === slide.flight) {
		return [
			{ transform: from, scale: RAISED, filter: LIFT_SHADOW, easing: 'ease-out' },
			{ transform: 'none', scale: FLAT, filter: LIFT_FLAT },
		];
	}

	return 'lifted' === slide.flight ? liftedFrames(from, travel) : flownFrames(from);
}

/** Already standing raised: it sets off as it is, and only falls once it is there. */
function liftedFrames(from: string, travel: number): Keyframe[] {
	return [
		{ transform: from, scale: RAISED, filter: LIFT_SHADOW, easing: 'ease-out' },
		{
			offset: travel / (travel + LIFT_DURATION),
			transform: 'none',
			scale: RAISED,
			filter: LIFT_SHADOW,
			easing: 'ease-out',
		},
		{ scale: FLAT, filter: LIFT_FLAT },
	];
}

/** Standing on the board: it rises as it sets off and is back down as it arrives. */
function flownFrames(from: string): Keyframe[] {
	return [
		{ transform: from, scale: FLAT, filter: LIFT_FLAT, easing: 'ease-out' },
		{ offset: LIFT_SHARE, scale: RAISED, filter: LIFT_SHADOW },
		{ offset: 1 - LIFT_SHARE, scale: RAISED, filter: LIFT_SHADOW, easing: 'ease-out' },
		{ transform: 'none', scale: FLAT, filter: LIFT_FLAT },
	];
}

/** The journey keeps its own easing, so the effect itself must not shape it twice. */
function timingFor(slide: PieceSlide, travel: number): KeyframeAnimationOptions {
	if (undefined === slide.flight) {
		return { duration: travel, easing: 'ease-out' };
	}

	if ('placed' === slide.flight) {
		return { duration: LIFT_DURATION, easing: 'ease-out' };
	}

	if ('drop' === slide.flight) {
		return { duration: LIFT_DURATION, easing: 'linear' };
	}

	return {
		duration: 'lifted' === slide.flight ? travel + LIFT_DURATION : travel,
		easing: 'linear',
	};
}
