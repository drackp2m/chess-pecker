import { Component, ElementRef, computed, inject, viewChild } from '@angular/core';

import { BoardDragGesture } from '@app/component/chess-board/board-drag';
import {
	Point,
	buildPromotionChoices,
	indexAtOrder,
	squareAtPoint,
} from '@app/component/chess-board/board-geometry';
import { createBoardPlayback } from '@app/component/chess-board/board-playback';
import { pieceElevation } from '@app/component/chess-board/board-stacking';
import { ChessPieceComponent, PieceSlide } from '@app/component/chess-piece/chess-piece.component';
import { BOARD_PRESENTER } from '@app/definition/board-presenter.interface';
import {
	BOARD_SIZE,
	FILES,
	PROMOTION_PIECES,
	RANKS,
	SQUARE_COUNT,
} from '@app/definition/chess.constant';
import { Piece, PromotionPieceType, Square } from '@app/definition/chess.type';
import { I18n } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { I18nService } from '@app/service/i18n.service';
import { ChessSquare } from '@app/util/chess/chess-square';
import { PIECE_LABEL_KEY } from '@app/util/chess/piece-label';

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
	/** Which piece is drawn over which while one of them is crossing the other. */
	readonly elevation: number | undefined;
	readonly fileLabel: string | undefined;
	readonly rankLabel: string | undefined;
}

@Component({
	selector: 'app-chess-board',
	templateUrl: './chess-board.component.html',
	styleUrl: './chess-board.component.scss',
	imports: [ChessPieceComponent, I18nPipe],
})
export class ChessBoardComponent {
	protected readonly I18n = I18n;

	readonly store = inject(BOARD_PRESENTER);

	private readonly preference = inject(BoardPreferenceService);
	private readonly i18n = inject(I18nService);

	readonly promotionChoices = buildPromotionChoices(PROMOTION_PIECES);

	/** Settled per beat, so changing the setting never replays one already on screen. */
	private readonly playback = createBoardPlayback({
		transition: this.store.transition,
		animation: this.preference.moveAnimation,
		orientation: this.store.orientation,
		speed: this.preference.moveSpeed,
	});

	/**
	 * What the board draws. A move of more than one beat runs a board of its own in
	 * between, which no store ever holds: everywhere else this is the real position.
	 */
	readonly position = computed(() => this.playback.board() ?? this.store.position());

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

	promotionLabel(piece: PromotionPieceType): string {
		return this.i18n.translate(I18n.common.PROMOTE_TO_PIECE, {
			piece: this.i18n.translate(PIECE_LABEL_KEY[this.promotionColor()][piece]),
		});
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
			return this.i18n.translate(
				square.isTarget ? I18n.common.SQUARE_MOVE_TO : I18n.common.SQUARE_EMPTY,
				{ square: square.square },
			);
		}

		const piece = this.i18n.translate(PIECE_LABEL_KEY[square.piece.color][square.piece.type]);

		return this.i18n.translate(
			square.isTarget ? I18n.common.SQUARE_CAPTURE : I18n.common.SQUARE_PIECE,
			{ piece, square: square.square },
		);
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
		const piece = this.position().board[index];

		return {
			square,
			piece,
			isLight: ChessSquare.isLight(index),
			isSelected: square === this.store.selected(),
			isTarget: undefined !== target,
			isCapture: undefined !== target?.captured,
			isLastMove: undefined !== lastMove && (square === lastMove.from || square === lastMove.to),
			isChecked: square === this.store.checkedSquare(),
			isMistake: undefined !== mistake && (square === mistake.from || square === mistake.to),
			isAnnounced: square === announced?.from,
			slide: this.describeSlide(square),
			elevation: undefined === piece ? undefined : pieceElevation(piece),
			fileLabel: 56 <= order ? FILES[ChessSquare.fileOf(index)] : undefined,
			rankLabel: 0 === order % 8 ? RANKS[ChessSquare.rowOf(index)] : undefined,
		};
	}

	/** Only the squares the beat landed on have anything to slide. */
	private describeSlide(square: Square): PieceSlide | undefined {
		return this.playback.slides().find((pending) => square === pending.to)?.slide;
	}
}
