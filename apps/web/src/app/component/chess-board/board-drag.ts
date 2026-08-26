import { Signal, computed, signal } from '@angular/core';

import {
	Point,
	hasPassedThreshold,
	resolveRelease,
} from '@app/component/chess-board/board-geometry';
import { Piece, Square } from '@app/definition/chess.type';

/** The piece riding the pointer, drawn over the board it was lifted from. */
export interface DragGhost {
	readonly piece: Piece;
	readonly x: number;
	readonly y: number;
	readonly size: number;
	/** What is left of the way from the square it was lifted from, as a CSS `translate`. */
	readonly offset: string;
	/** Whether the piece has already caught up with the pointer. */
	readonly isSettled: boolean;
}

export interface BoardDragOptions {
	/** Which square a pointer sits over, in the geometry of the board being drawn. */
	readonly squareAt: (point: Point) => Square | undefined;
	readonly pieceAt: (square: Square) => Piece | undefined;
	/** Side of one square, in pixels, so the dragged piece keeps its size. */
	readonly squareSize: () => number;
	/** Middle of a square, in the geometry of the board being drawn. */
	readonly squareCenter: (square: Square) => Point;
	readonly isClickEnabled: () => boolean;
	/** Picks the piece up, so the board shows where it may go while it travels. */
	readonly pick: (square: Square) => void;
}

/**
 * The press-drag-release gesture, kept off any one board so the full board and the demo
 * strip behave alike. Only the geometry differs, and it arrives as `squareAt`.
 */
export class BoardDragGesture {
	readonly draggingFrom: Signal<Square | undefined>;
	readonly ghost: Signal<DragGhost | undefined>;

	private readonly dragging = signal<Square | undefined>(undefined);
	private readonly pointer = signal<Point | undefined>(undefined);
	private readonly catchUp = signal<Point | undefined>(undefined);

	private from: Square | undefined;
	private origin: Point | undefined;
	private hasDragged = false;
	private isDraggable = false;

	constructor(private readonly options: BoardDragOptions) {
		this.draggingFrom = this.dragging.asReadonly();
		this.ghost = computed(() => this.describeGhost());
	}

	press(square: Square, isDraggable: boolean, point: Point): void {
		this.hasDragged = false;
		this.from = square;
		this.origin = point;
		this.isDraggable = isDraggable;
	}

	/** The first move past the threshold picks the piece up; the rest just carry it. */
	move(point: Point): void {
		const from = this.from;
		const origin = this.origin;
		const isStarting = !this.hasDragged;

		if (!this.isDraggable || undefined === from || undefined === origin) {
			return;
		}

		if (isStarting && !hasPassedThreshold(origin, point)) {
			return;
		}

		if (isStarting) {
			this.hasDragged = true;
			this.dragging.set(from);
			this.lift(from, point);
			this.options.pick(from);
		}

		this.pointer.set(point);
	}

	/** The square the release acts on, if any; the gesture is over either way. */
	release(point: Point): Square | undefined {
		const from = this.from;
		const wasDrag = this.hasDragged;

		this.cancel();

		return resolveRelease({
			from,
			released: this.options.squareAt(point),
			wasDrag,
			isClickEnabled: this.options.isClickEnabled(),
		});
	}

	cancel(): void {
		this.from = undefined;
		this.origin = undefined;
		this.hasDragged = false;
		this.isDraggable = false;
		this.dragging.set(undefined);
		this.pointer.set(undefined);
		this.catchUp.set(undefined);
	}

	/**
	 * The piece is drawn where it was standing and only then let go of, so it travels to the
	 * pointer instead of appearing under it however far away the press landed.
	 */
	private lift(from: Square, point: Point): void {
		const center = this.options.squareCenter(from);

		this.catchUp.set({ x: center.x - point.x, y: center.y - point.y });

		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				this.catchUp.set(undefined);
			});
		});
	}

	private describeGhost(): DragGhost | undefined {
		const from = this.dragging();
		const point = this.pointer();
		const piece = undefined === from ? undefined : this.options.pieceAt(from);

		if (undefined === point || undefined === piece) {
			return undefined;
		}

		const size = this.options.squareSize();
		const catchUp = this.catchUp();

		return {
			piece,
			x: point.x - size / 2,
			y: point.y - size / 2,
			size,
			offset: undefined === catchUp ? '0 0' : `${catchUp.x.toString()}px ${catchUp.y.toString()}px`,
			isSettled: undefined === catchUp,
		};
	}
}
