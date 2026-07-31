import { Component, ElementRef, computed, inject, viewChild } from '@angular/core';

import { BoardDragGesture } from '@app/component/chess-board/board-drag';
import {
	Point,
	buildPromotionChoices,
	indexAtOrder,
	slideOffset,
	squareAtPoint,
} from '@app/component/chess-board/board-geometry';
import { ChessPieceComponent, PieceSlide } from '@app/component/chess-piece/chess-piece.component';
import { shouldAnimate } from '@app/definition/board-animation.type';
import { BOARD_PRESENTER } from '@app/definition/board-presenter.interface';
import {
	BOARD_SIZE,
	FILES,
	PROMOTION_PIECES,
	RANKS,
	SQUARE_COUNT,
} from '@app/definition/chess.constant';
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

@Component({
	selector: 'app-chess-board',
	templateUrl: './chess-board.component.html',
	styleUrl: './chess-board.component.scss',
	imports: [ChessPieceComponent],
})
export class ChessBoardComponent {
	readonly store = inject(BOARD_PRESENTER);

	private readonly preference = inject(BoardPreferenceService);

	readonly promotionChoices = buildPromotionChoices(PROMOTION_PIECES);

	/** Chosen in the settings; decides which transitions get a sliding animation. */
	readonly animation = this.preference.moveAnimation;

	// Read as signals, so changing the preference takes effect on a board already
	// on screen rather than only on the next one.
	readonly isClickEnabled = computed(() => this.preference.moveInputMethods().includes('click'));
	readonly isDragEnabled = computed(() => this.preference.moveInputMethods().includes('drag'));

	private readonly gesture = new BoardDragGesture({
		squareAt: (point) => this.squareAt(point),
		pieceAt: (square) => this.store.position().board[ChessSquare.toIndex(square)],
		squareSize: () => this.board().nativeElement.getBoundingClientRect().width / BOARD_SIZE,
		isClickEnabled: () => this.isClickEnabled(),
		pick: (square) => {
			if (square !== this.store.selected()) {
				this.store.selectSquare(square);
			}
		},
	});

	/** Square the pointer picked up, once the press has grown into a real drag. */
	readonly draggingFrom = this.gesture.draggingFrom;
	readonly ghost = this.gesture.ghost;

	/** The 64 squares already laid out in reading order for the current orientation. */
	readonly squares = computed<BoardSquare[]>(() => {
		const orientation = this.store.orientation();

		return Array.from({ length: SQUARE_COUNT }, (_unused, order) =>
			this.describeSquare(indexAtOrder(order, orientation), order),
		);
	});

	readonly promotionColor = computed(() => this.store.position().turn);

	private readonly board = viewChild.required<ElementRef<HTMLElement>>('board');

	/**
	 * Keyboard activation only. Pointer taps are resolved in `dropSquare`, because a
	 * captured pointer delivers its `click` to the board rather than to the square.
	 */
	activate(square: BoardSquare, event: MouseEvent): void {
		if (0 === event.detail && this.isClickEnabled()) {
			this.store.selectSquare(square.square);
		}
	}

	promote(piece: PromotionPieceType): void {
		this.store.completePromotion(piece);
	}

	pressSquare(square: BoardSquare, event: PointerEvent): void {
		const isDraggable = this.isDragEnabled() && undefined !== square.piece;

		this.gesture.press(square.square, isDraggable, { x: event.clientX, y: event.clientY });

		if (isDraggable) {
			this.capturePointer(event.pointerId);
		}
	}

	dragSquare(event: PointerEvent): void {
		this.gesture.move({ x: event.clientX, y: event.clientY });
	}

	/** Resolves both gestures: a drop lands the piece, a tap acts as a click. */
	dropSquare(event: PointerEvent): void {
		const target = this.gesture.release({ x: event.clientX, y: event.clientY });

		if (undefined !== target) {
			this.store.selectSquare(target);
		}
	}

	cancelDrag(): void {
		this.gesture.cancel();
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

	private squareAt(point: Point): Square | undefined {
		return squareAtPoint(
			this.board().nativeElement.getBoundingClientRect(),
			point,
			this.store.orientation(),
		);
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
