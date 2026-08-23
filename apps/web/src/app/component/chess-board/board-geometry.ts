import { BOARD_SIZE, FILES, SQUARE_COUNT } from '@app/definition/chess.constant';
import { PieceColor, PromotionPieceType, Square } from '@app/definition/chess.type';
import { ChessSquare } from '@app/util/chess/chess-square';

/** Pointer distance, in pixels, before a press is treated as a drag and not a click. */
export const DRAG_THRESHOLD = 6;

export interface Point {
	readonly x: number;
	readonly y: number;
}

/** Board index shown at a given position of the rendered grid, honouring the flip. */
export function indexAtOrder(order: number, orientation: PieceColor): number {
	return 'white' === orientation ? order : SQUARE_COUNT - 1 - order;
}

/** Which square a pointer is over, or `undefined` when it is off the board. */
export function squareAtPoint(
	rect: DOMRect,
	point: Point,
	orientation: PieceColor,
): Square | undefined {
	const column = Math.floor(((point.x - rect.left) / rect.width) * BOARD_SIZE);
	const row = Math.floor(((point.y - rect.top) / rect.height) * BOARD_SIZE);

	if (0 > column || column >= BOARD_SIZE || 0 > row || row >= BOARD_SIZE) {
		return undefined;
	}

	return ChessSquare.fromIndex(indexAtOrder(row * BOARD_SIZE + column, orientation));
}

/**
 * How far a piece has to travel to reach its destination, as a percentage of one
 * square, expressed as the offset it should animate *from*.
 */
export function slideOffset(from: Square, to: Square, orientation: PieceColor): Point {
	const fromIndex = ChessSquare.toIndex(from);
	const toIndex = ChessSquare.toIndex(to);
	// A flipped board reverses the travel; swapping the operands avoids a signed zero.
	const [start, end] = 'white' === orientation ? [fromIndex, toIndex] : [toIndex, fromIndex];

	return {
		x: (ChessSquare.fileOf(start) - ChessSquare.fileOf(end)) * 100,
		y: (ChessSquare.rowOf(start) - ChessSquare.rowOf(end)) * 100,
	};
}

export function hasPassedThreshold(origin: Point, point: Point): boolean {
	return DRAG_THRESHOLD <= Math.hypot(point.x - origin.x, point.y - origin.y);
}

export interface PromotionChoice {
	readonly piece: PromotionPieceType;
	readonly isLight: boolean;
	readonly fileLabel: string | undefined;
	readonly rankLabel: string | undefined;
}

/**
 * Lays the four promotion pieces out as the corner of a board — a2 b2 over a1 b1 —
 * so the picker reads like the thing it is part of, coordinates included.
 */
export function buildPromotionChoices(
	pieces: readonly PromotionPieceType[],
): readonly PromotionChoice[] {
	return pieces.map((piece, order) => {
		const file = order % 2;
		const rank = 2 - Math.floor(order / 2);

		return {
			piece,
			// a1 is a dark square, and the colours alternate from there.
			isLight: 0 === (file + rank) % 2,
			rankLabel: 0 === file ? rank.toString() : undefined,
			fileLabel: 1 < order ? FILES[file] : undefined,
		};
	});
}

export interface ReleaseContext {
	/** Square the press started on. */
	readonly from: Square | undefined;
	/** Square under the pointer when it was released. */
	readonly released: Square | undefined;
	/** Whether the press grew past the drag threshold. */
	readonly wasDrag: boolean;
	readonly isClickEnabled: boolean;
}

/**
 * Which square a pointer release acts on. Resolved here and not from a `click` listener:
 * capturing the pointer for dragging retargets `click` to the capturing element.
 */
export function resolveRelease(context: ReleaseContext): Square | undefined {
	const { from, released, wasDrag, isClickEnabled } = context;

	if (undefined === from || undefined === released) {
		return undefined;
	}

	// Dropping a dragged piece back where it started keeps it selected instead.
	if (wasDrag) {
		return released === from ? undefined : released;
	}

	return isClickEnabled ? released : undefined;
}
