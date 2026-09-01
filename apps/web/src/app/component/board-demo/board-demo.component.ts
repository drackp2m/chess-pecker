import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';

import { BoardDragGesture } from '@app/component/chess-board/board-drag';
import { Point, dropOffset } from '@app/component/chess-board/board-geometry';
import { PieceLaunch, describeLaunch, launchSlides } from '@app/component/chess-board/board-launch';
import { createBoardPlayback } from '@app/component/chess-board/board-playback';
import { squareElevation } from '@app/component/chess-board/board-stacking';
import { ChessPieceComponent, PieceSlide } from '@app/component/chess-piece/chess-piece.component';
import { BOARD_SIZE, FILES, RANKS, SQUARE_COUNT } from '@app/definition/chess.constant';
import { Piece, PieceColor, Square } from '@app/definition/chess.type';
import { Puzzle } from '@app/definition/puzzle.type';
import { ButtonDirective } from '@app/directive/button.directive';
import { I18n } from '@app/i18n';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library/puzzle-library.store';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { I18nService } from '@app/service/i18n.service';
import { ChessSquare } from '@app/util/chess/chess-square';
import { PIECE_LABEL_KEY } from '@app/util/chess/piece-label';

/** Board index of a1: the strip draws the first rank, which is the last row of all. */
const RANK_START = SQUARE_COUNT - BOARD_SIZE;

/**
 * Three rooks on one rank: black takes, white takes back, everything else is a miss. No
 * kings, which only the CSV import would object to.
 */
const DEMO_PUZZLE: Puzzle = {
	id: 'demo',
	fen: '8/8/8/8/8/8/8/R3R2r b - - 0 1',
	moves: ['h1e1', 'a1e1'],
	rating: 0,
	themes: [],
	selectedFor: '',
};

interface DemoSquare {
	readonly square: Square;
	readonly piece: Piece | undefined;
	readonly isLight: boolean;
	readonly isSelected: boolean;
	readonly isTarget: boolean;
	readonly isCapture: boolean;
	readonly isLastMove: boolean;
	readonly isMistake: boolean;
	readonly isAnnounced: boolean;
	readonly slide: PieceSlide | undefined;
	readonly taken: Piece | undefined;
	readonly elevation: number | undefined;
	readonly fileLabel: string | undefined;
	readonly rankLabel: string | undefined;
}

/**
 * The settings screen's board: eight squares driven by the real `PuzzleStore`, so every
 * preference can be tried where it is chosen. Only the drawing is new.
 */
@Component({
	selector: 'app-board-demo',
	templateUrl: './board-demo.component.html',
	styleUrl: './board-demo.component.scss',
	imports: [ChessPieceComponent, ButtonDirective, I18nPipe],
	providers: [PuzzleLibraryStore, PuzzleStore],
})
export class BoardDemoComponent {
	protected readonly I18n = I18n;

	readonly store = inject(PuzzleStore);

	private readonly preference = inject(BoardPreferenceService);
	private readonly i18n = inject(I18nService);

	/** The strip always reads a1 to h1, so its slides are measured unflipped. */
	private readonly stripOrientation = signal<PieceColor>('white');

	/** Settled per beat, so changing the setting never replays one already on screen. */
	private readonly playback = createBoardPlayback({
		transition: this.store.transition,
		animation: this.preference.moveAnimation,
		orientation: this.stripOrientation,
		speed: this.preference.moveSpeed,
	});

	/** The board on screen: a beat of its own while a move takes more than one. */
	readonly position = computed(() => this.playback.board() ?? this.store.position());

	readonly isClickEnabled = computed(() => this.preference.moveInputMethods().includes('click'));
	readonly isDragEnabled = computed(() => this.preference.moveInputMethods().includes('drag'));
	readonly isLiftEnabled = computed(() => this.preference.moveLift());

	private readonly gesture = new BoardDragGesture({
		squareAt: (point) => this.squareAt(point),
		pieceAt: (square) => this.store.position().board[ChessSquare.toIndex(square)],
		squareSize: () => this.strip().nativeElement.getBoundingClientRect().width / BOARD_SIZE,
		squareCenter: (square) => this.centerOf(square),
		isClickEnabled: () => this.isClickEnabled(),
		pick: (square) => {
			const isRaised = square === this.store.selected();

			if (!isRaised) {
				this.commit(square, undefined);
			}

			return isRaised;
		},
	});

	readonly draggingFrom = this.gesture.draggingFrom;
	readonly ghost = this.gesture.ghost;

	readonly squares = computed<DemoSquare[]>(() =>
		Array.from({ length: BOARD_SIZE }, (_unused, file) => this.describeSquare(file)),
	);

	readonly hint = computed(() => this.describe());

	private readonly launch = signal<PieceLaunch | undefined>(undefined);

	private readonly slides = computed(() =>
		launchSlides(
			this.playback.slides(),
			this.launch(),
			this.store.transition(),
			this.isLiftEnabled(),
		),
	);

	private readonly strip = viewChild.required<ElementRef<HTMLElement>>('strip');

	constructor() {
		this.reset();
	}

	/** A fresh attempt, verdict included, so the threshold can be tried again. */
	reset(): void {
		this.store.setPuzzles([DEMO_PUZZLE]);
	}

	activate(square: DemoSquare, event: MouseEvent): void {
		if (0 === event.detail && this.isClickEnabled()) {
			this.commit(square.square, undefined);
		}
	}

	pressSquare(square: DemoSquare, event: PointerEvent): void {
		const isDraggable = this.isDragEnabled() && undefined !== square.piece;

		this.gesture.press(square.square, isDraggable, { x: event.clientX, y: event.clientY });

		if (isDraggable) {
			this.capturePointer(event.pointerId);
		}
	}

	dragSquare(event: PointerEvent): void {
		this.gesture.move({ x: event.clientX, y: event.clientY });
	}

	dropSquare(event: PointerEvent): void {
		const point = { x: event.clientX, y: event.clientY };
		const wasCarried = undefined !== this.draggingFrom();
		const target = this.gesture.release(point);

		if (undefined !== target) {
			this.commit(target, wasCarried ? this.dropOffset(target, point) : undefined);
		}
	}

	cancelDrag(): void {
		this.gesture.cancel();
	}

	label(square: DemoSquare): string {
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

	private commit(square: Square, drop: Point | undefined): void {
		const move = { from: this.store.selected(), to: square };
		const before = this.store.transition();

		this.store.selectSquare(square);

		this.launch.set(describeLaunch(move, drop, before, this.store.transition()));
	}

	private dropOffset(square: Square, point: Point): Point {
		const size = this.strip().nativeElement.getBoundingClientRect().width / BOARD_SIZE;

		return dropOffset(this.centerOf(square), point, size);
	}

	/** Feature-detected: not every test environment implements pointer capture. */
	private capturePointer(pointerId: number): void {
		const element = this.strip().nativeElement;

		if ('function' === typeof (element as { setPointerCapture?: unknown }).setPointerCapture) {
			element.setPointerCapture(pointerId);
		}
	}

	/** One rank, so a square is only ever as far along as its file. */
	private centerOf(square: Square): Point {
		const rect = this.strip().nativeElement.getBoundingClientRect();
		const file = ChessSquare.fileOf(ChessSquare.toIndex(square));

		return {
			x: rect.left + ((0.5 + file) * rect.width) / BOARD_SIZE,
			y: rect.top + rect.height / 2,
		};
	}

	/** One rank, so only the file matters; anything outside it drops the gesture. */
	private squareAt(point: Point): Square | undefined {
		const rect = this.strip().nativeElement.getBoundingClientRect();
		const file = Math.floor(((point.x - rect.left) / rect.width) * BOARD_SIZE);

		return 0 > file || file >= BOARD_SIZE ? undefined : ChessSquare.fromIndex(RANK_START + file);
	}

	private describeSquare(file: number): DemoSquare {
		const index = RANK_START + file;
		const square = ChessSquare.fromIndex(index);
		const target = this.store.movesFromSelection().find((move) => square === move.to);
		const lastMove = this.store.lastMove();
		const mistake = this.store.mistake();
		const piece = this.position().board[index];
		const travelling = this.slides().find((pending) => square === pending.to);
		const isSelected = square === this.store.selected();

		return {
			square,
			piece,
			isLight: ChessSquare.isLight(index),
			isSelected,
			isTarget: undefined !== target,
			isCapture: undefined !== target?.captured,
			isLastMove: undefined !== lastMove && (square === lastMove.from || square === lastMove.to),
			isMistake: undefined !== mistake && (square === mistake.from || square === mistake.to),
			isAnnounced: square === this.store.announcedMove()?.from,
			slide: travelling?.slide,
			taken: this.playback.isSliding() ? travelling?.taken : undefined,
			elevation: squareElevation(piece, isSelected || undefined !== travelling?.slide),
			// The strip is a board's bottom rank, so it carries that rank's edge: every
			// square names its file, and only the first one names the rank.
			fileLabel: FILES[ChessSquare.fileOf(index)],
			rankLabel: 0 === file ? RANKS[ChessSquare.rowOf(index)] : undefined,
		};
	}

	/** Only the squares the beat landed on have anything to slide. */
	private describe(): string {
		if (this.store.isRevealing()) {
			return I18n.common.DEMO_PLAYING_ANSWER;
		}

		switch (this.store.outcome()) {
			case 'idle':
			case 'opening':
			case 'replying':
				return I18n.common.DEMO_RIVAL_MOVING;
			case 'failed':
				return I18n.common.DEMO_WRONG_MOVE;
			case 'solved':
				return I18n.common.DEMO_DONE;
			case 'solving':
				return I18n.common.DEMO_TASK;
		}
	}
}
