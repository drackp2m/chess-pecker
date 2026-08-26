import {
	Component,
	ElementRef,
	computed,
	effect,
	inject,
	signal,
	untracked,
	viewChild,
} from '@angular/core';

import { BoardDragGesture } from '@app/component/chess-board/board-drag';
import {
	Point,
	buildPromotionChoices,
	dropOffset,
	indexAtOrder,
	pointAtSquare,
	squareAtPoint,
} from '@app/component/chess-board/board-geometry';
import { PieceLaunch, describeLaunch, liftSlides } from '@app/component/chess-board/board-launch';
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
import { ChessBoard } from '@app/util/chess/chess-board';
import { ChessMoveGenerator } from '@app/util/chess/chess-move-generator';
import { ChessSquare } from '@app/util/chess/chess-square';
import { PIECE_LABEL_KEY } from '@app/util/chess/piece-label';

interface HeldPick {
	readonly square: Square;
	readonly drop: Point | undefined;
}

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
	/** The piece this square is about to lose, still standing while it is taken. */
	readonly taken: Piece | undefined;
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
	readonly isLiftEnabled = computed(() => this.preference.moveLift());

	private readonly gesture = new BoardDragGesture({
		squareAt: (point) => this.squareAt(point),
		pieceAt: (square) => this.store.position().board[ChessSquare.toIndex(square)],
		squareSize: () => this.squareSize(),
		squareCenter: (square) => this.centerOf(square),
		isClickEnabled: () => this.isClickEnabled(),
		// Read off what is drawn picked up rather than off the store, or a drag begun on a
		// piece the board is already holding would take the same one up twice.
		pick: (square) => {
			const isRaised = square === this.pickedUp();

			if (!isRaised) {
				this.pickSquare(square);
			}

			return isRaised;
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

	/** Held back while a piece is still on its way, so a check lands with the move. */
	readonly checkedSquare = computed(() =>
		this.playback.isSliding() ? undefined : this.store.checkedSquare(),
	);

	readonly promotionColor = computed(() => this.store.position().turn);

	/**
	 * Whether the board still has a move to draw. The beats are the view's own, and the store
	 * is asked too: its pauses have nothing sliding in them, and a move that is only lit has
	 * not set off yet.
	 */
	private readonly isDrawing = computed(
		() =>
			!this.playback.isSettled() || this.store.isBusy() || undefined !== this.store.announcedMove(),
	);

	/**
	 * Squares acted on while the board was drawing, in the order they were given. Nothing is
	 * refused any more: they are played the moment the board stops, so a move given over the
	 * opponent's queues behind it instead of cutting the piece on screen short.
	 */
	private readonly held = signal<readonly HeldPick[]>([]);

	private readonly launch = signal<PieceLaunch | undefined>(undefined);

	private promotionDrop: Point | undefined;

	private readonly slides = computed(() =>
		this.isLiftEnabled()
			? liftSlides(this.playback.slides(), this.launch(), this.store.transition())
			: this.playback.slides(),
	);

	/**
	 * The board a piece taken up now will move on: what the state holds, plus the move that is
	 * lit up and has not been played yet. Once it has been, the state already holds it.
	 */
	private readonly landing = computed(() => {
		const announced = this.store.announcedMove();
		const position = this.store.position();

		return undefined === announced ? position : ChessBoard.apply(position, announced);
	});

	/**
	 * Whether the board takes a piece up at all while it is drawing. Being busy is no reason
	 * not to: what it is busy with is the very move being waited out. A board that is shut for
	 * good, or holding a refuted move until it is taken back, takes nothing.
	 */
	private readonly isTakingUp = computed(
		() => (!this.store.isLocked() || this.store.isBusy()) && undefined === this.store.mistake(),
	);

	/** The square the board is holding one of the player's pieces on, if it is holding one. */
	private readonly heldPick = computed(() =>
		this.isTakingUp() ? this.lastOwnPiece(this.held()) : undefined,
	);

	/**
	 * The square drawn picked up: the one the board is holding, so a press over a move still
	 * crossing is seen to land, and the store's own otherwise.
	 */
	private readonly pickedUp = computed(() => this.heldPick() ?? this.store.selected());

	/**
	 * The moves the board marks. While it is holding a piece they are read off the board that
	 * piece will move on, so where it may go is shown before the move on screen has arrived.
	 */
	private readonly targets = computed(() => {
		const held = this.heldPick();

		return undefined === held
			? this.store.movesFromSelection()
			: ChessMoveGenerator.movesFrom(this.landing(), ChessSquare.toIndex(held));
	});

	private readonly board = viewChild.required<ElementRef<HTMLElement>>('board');

	constructor() {
		// Only the view knows when the last piece has arrived, so it is the view that lets go
		// of what was given while one was still crossing.
		effect(() => {
			if (this.isDrawing() || 0 === this.held().length) {
				return;
			}

			untracked(() => {
				this.releaseHeld();
			});
		});
	}

	/**
	 * Keyboard activation only. Pointer taps are resolved in `dropSquare`, because a
	 * captured pointer delivers its `click` to the board rather than to the square.
	 */
	activate(square: BoardSquare, event: MouseEvent): void {
		if (0 === event.detail && this.isClickEnabled()) {
			this.pickSquare(square.square);
		}
	}

	promotionLabel(piece: PromotionPieceType): string {
		return this.i18n.translate(I18n.common.PROMOTE_TO_PIECE, {
			piece: this.i18n.translate(PIECE_LABEL_KEY[this.promotionColor()][piece]),
		});
	}

	promote(piece: PromotionPieceType): void {
		const pending = this.store.pendingPromotion();
		const before = this.store.transition();

		this.store.completePromotion(piece);

		if (undefined !== pending) {
			this.launch.set(describeLaunch(pending, this.promotionDrop, before, this.store.transition()));
		}
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
		const point = { x: event.clientX, y: event.clientY };
		const wasCarried = undefined !== this.draggingFrom();
		const target = this.gesture.release(point);

		if (undefined !== target) {
			this.pickSquare(target, wasCarried ? this.dropOffset(target, point) : undefined);
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

	/**
	 * The one way a square is acted on, so the board holds the lot at once. Over a board still
	 * drawing nothing is lost and nothing is played: it waits for the piece on screen to arrive.
	 */
	private pickSquare(square: Square, drop?: Point): void {
		if (this.isDrawing()) {
			this.held.update((held) => [...held, { square, drop }]);

			return;
		}

		this.commit(square, drop);
	}

	private commit(square: Square, drop: Point | undefined): void {
		const move = { from: this.pickedUp(), to: square };
		const before = this.store.transition();

		this.store.selectSquare(square);

		this.launch.set(describeLaunch(move, drop, before, this.store.transition()));
		this.promotionDrop = undefined === this.store.pendingPromotion() ? undefined : drop;
	}

	/**
	 * Gives the board everything it was holding, in the order it was given. It stops at the
	 * one that sets the board moving again: whatever came after was aimed at a board that
	 * never existed, and a second move may not be queued onto the opponent's answer.
	 */
	private releaseHeld(): void {
		const held = this.held();

		this.held.set([]);

		for (const pick of held) {
			if (this.isDrawing()) {
				return;
			}

			this.commit(pick.square, pick.drop);
		}
	}

	/** The last square held that has a piece of the player's standing on the landing board. */
	private lastOwnPiece(held: readonly HeldPick[]): Square | undefined {
		const color = this.store.playerColor();
		const board = this.landing().board;

		return held.findLast(({ square }) => color === board[ChessSquare.toIndex(square)]?.color)
			?.square;
	}

	/** Feature-detected: not every test environment implements pointer capture. */
	private capturePointer(pointerId: number): void {
		const element = this.board().nativeElement;

		if ('function' === typeof (element as { setPointerCapture?: unknown }).setPointerCapture) {
			element.setPointerCapture(pointerId);
		}
	}

	private squareSize(): number {
		return this.board().nativeElement.getBoundingClientRect().width / BOARD_SIZE;
	}

	private dropOffset(square: Square, point: Point): Point {
		return dropOffset(this.centerOf(square), point, this.squareSize());
	}

	private centerOf(square: Square): Point {
		return pointAtSquare(
			this.board().nativeElement.getBoundingClientRect(),
			square,
			this.store.orientation(),
		);
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
		const target = this.targets().find((move) => square === move.to);
		const lastMove = this.store.lastMove();
		const mistake = this.store.mistake();
		const announced = this.store.announcedMove();
		const piece = this.position().board[index];
		const travelling = this.slides().find((pending) => square === pending.to);

		return {
			square,
			piece,
			isLight: ChessSquare.isLight(index),
			isSelected: square === this.pickedUp(),
			isTarget: undefined !== target,
			isCapture: undefined !== target?.captured,
			isLastMove: undefined !== lastMove && (square === lastMove.from || square === lastMove.to),
			isChecked: square === this.checkedSquare(),
			isMistake: undefined !== mistake && (square === mistake.from || square === mistake.to),
			isAnnounced: square === announced?.from,
			slide: travelling?.slide,
			taken: this.playback.isSliding() ? travelling?.taken : undefined,
			elevation: undefined === piece ? undefined : pieceElevation(piece),
			fileLabel: 56 <= order ? FILES[ChessSquare.fileOf(index)] : undefined,
			rankLabel: 0 === order % 8 ? RANKS[ChessSquare.rowOf(index)] : undefined,
		};
	}
}
