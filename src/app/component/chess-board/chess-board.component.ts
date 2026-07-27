import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';

import {
	buildPromotionChoices,
	hasPassedThreshold,
	indexAtOrder,
	resolveRelease,
	slideOffset,
	squareAtPoint,
} from '@app/component/chess-board/board-geometry';
import { ChessPieceComponent, PieceSlide } from '@app/component/chess-piece/chess-piece.component';
import { shouldAnimate } from '@app/definition/board-animation.type';
import { MOVE_INPUT_METHODS } from '@app/definition/board-input.type';
import { BOARD_PRESENTER } from '@app/definition/board-presenter.interface';
import { FILES, PROMOTION_PIECES, RANKS, SQUARE_COUNT } from '@app/definition/chess.constant';
import { Piece, PromotionPieceType, Square } from '@app/definition/chess.type';
import { BoardPreferenceService } from '@app/service/board-preference.service';
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
	/** Origin of a move that is about to be played for you. */
	readonly isAnnounced: boolean;
	readonly slide: PieceSlide | undefined;
	readonly fileLabel: string | undefined;
	readonly rankLabel: string | undefined;
}

interface DragGhost {
	readonly piece: Piece;
	readonly x: number;
	readonly y: number;
	readonly size: number;
}

@Component({
	selector: 'app-chess-board',
	templateUrl: './chess-board.component.html',
	styleUrl: './chess-board.component.scss',
	imports: [ChessPieceComponent],
})
export class ChessBoardComponent {
	readonly store = inject(BOARD_PRESENTER);

	readonly promotionChoices = buildPromotionChoices(PROMOTION_PIECES);

	/** Chosen in the settings; decides which transitions get a sliding animation. */
	readonly animation = inject(BoardPreferenceService).moveAnimation;

	readonly isClickEnabled = inject(MOVE_INPUT_METHODS).includes('click');
	readonly isDragEnabled = inject(MOVE_INPUT_METHODS).includes('drag');

	/** Square the pointer picked up, once the press has grown into a real drag. */
	readonly draggingFrom = signal<Square | undefined>(undefined);
	readonly ghost = signal<DragGhost | undefined>(undefined);

	/** The 64 squares already laid out in reading order for the current orientation. */
	readonly squares = computed<BoardSquare[]>(() => {
		const orientation = this.store.orientation();

		return Array.from({ length: SQUARE_COUNT }, (_unused, order) =>
			this.describeSquare(indexAtOrder(order, orientation), order),
		);
	});

	readonly promotionColor = computed(() => this.store.playerColor());

	private readonly board = viewChild.required<ElementRef<HTMLElement>>('board');

	private pressedFrom: Square | undefined;
	private pressedAt: { x: number; y: number } | undefined;
	private hasDragged = false;
	private canDrag = false;

	/**
	 * Keyboard activation only. Pointer taps are resolved in `dropSquare`, because a
	 * captured pointer delivers its `click` to the board rather than to the square.
	 */
	activate(square: BoardSquare, event: MouseEvent): void {
		if (0 === event.detail && this.isClickEnabled) {
			this.store.selectSquare(square.square);
		}
	}

	promote(piece: PromotionPieceType): void {
		this.store.completePromotion(piece);
	}

	pressSquare(square: BoardSquare, event: PointerEvent): void {
		this.hasDragged = false;
		this.pressedFrom = square.square;
		this.pressedAt = { x: event.clientX, y: event.clientY };
		this.canDrag = this.isDragEnabled && undefined !== square.piece;

		if (this.canDrag) {
			this.capturePointer(event.pointerId);
		}
	}

	dragSquare(event: PointerEvent): void {
		const from = this.pressedFrom;
		const origin = this.pressedAt;

		if (!this.canDrag || undefined === from || undefined === origin) {
			return;
		}

		const point = { x: event.clientX, y: event.clientY };

		if (!this.hasDragged && !hasPassedThreshold(origin, point)) {
			return;
		}

		// The first move past the threshold picks the piece up and reveals its targets.
		if (!this.hasDragged) {
			this.hasDragged = true;
			this.draggingFrom.set(from);

			if (from !== this.store.selected()) {
				this.store.selectSquare(from);
			}
		}

		this.ghost.set(this.buildGhost(from, point));
	}

	/** Resolves both gestures: a drop lands the piece, a tap acts as a click. */
	dropSquare(event: PointerEvent): void {
		const from = this.pressedFrom;
		const wasDrag = this.hasDragged;

		this.cancelDrag();

		const target = resolveRelease({
			from,
			released: squareAtPoint(
				this.board().nativeElement.getBoundingClientRect(),
				{ x: event.clientX, y: event.clientY },
				this.store.orientation(),
			),
			wasDrag,
			isClickEnabled: this.isClickEnabled,
		});

		if (undefined !== target) {
			this.store.selectSquare(target);
		}
	}

	cancelDrag(): void {
		this.pressedFrom = undefined;
		this.pressedAt = undefined;
		this.hasDragged = false;
		this.canDrag = false;
		this.draggingFrom.set(undefined);
		this.ghost.set(undefined);
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

	/** Feature-detected: not every test environment implements pointer capture. */
	private capturePointer(pointerId: number): void {
		const element = this.board().nativeElement;

		if ('function' === typeof (element as { setPointerCapture?: unknown }).setPointerCapture) {
			element.setPointerCapture(pointerId);
		}
	}

	private buildGhost(from: Square, point: { x: number; y: number }): DragGhost | undefined {
		const piece = this.store.position().board[ChessSquare.toIndex(from)];

		if (undefined === piece) {
			return undefined;
		}

		const size = this.board().nativeElement.getBoundingClientRect().width / 8;

		return { piece, x: point.x - size / 2, y: point.y - size / 2, size };
	}

	private describeSquare(index: number, order: number): BoardSquare {
		const square = ChessSquare.fromIndex(index);
		const target = this.store.movesFromSelection().find((move) => square === move.to);
		const lastMove = this.store.lastMove();
		const mistake = this.store.mistake();
		const announced = this.store.announcedMove();

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
			isAnnounced: square === announced?.from,
			slide: this.describeSlide(square, order),
			fileLabel: 56 <= order ? FILES[ChessSquare.fileOf(index)] : undefined,
			rankLabel: 0 === order % 8 ? RANKS[ChessSquare.rowOf(index)] : undefined,
		};
	}

	/**
	 * Slides the square a transition landed on, when the chosen animation level says
	 * that kind of transition is worth animating.
	 */
	private describeSlide(square: Square, order: number): PieceSlide | undefined {
		const transition = this.store.transition();

		if (square !== transition?.to || !shouldAnimate(transition.kind, this.animation())) {
			return undefined;
		}

		const offset = slideOffset(transition.from, transition.to, this.store.orientation());

		return { ...offset, key: transition.tick * SQUARE_COUNT + order };
	}
}
