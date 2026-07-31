import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';

import { BoardDragGesture } from '@app/component/chess-board/board-drag';
import { Point } from '@app/component/chess-board/board-geometry';
import { createBoardSlide } from '@app/component/chess-board/board-slide';
import { ChessPieceComponent, PieceSlide } from '@app/component/chess-piece/chess-piece.component';
import { BOARD_SIZE, FILES, RANKS, SQUARE_COUNT } from '@app/definition/chess.constant';
import { Piece, PieceColor, Square } from '@app/definition/chess.type';
import { Puzzle } from '@app/definition/puzzle.type';
import { ButtonDirective } from '@app/directive/button.directive';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library/puzzle-library.store';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { ChessSquare } from '@app/util/chess/chess-square';

/** Board index of a1: the strip draws the first rank, which is the last row of all. */
const RANK_START = SQUARE_COUNT - BOARD_SIZE;

/**
 * Three rooks on one rank. Black opens by taking one of white's, and the answer is to
 * take the black rook back; every other legal move is a miss. No kings, which only the
 * CSV import would object to — the engine skips the check logic when it finds none.
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
	readonly fileLabel: string | undefined;
	readonly rankLabel: string | undefined;
}

/**
 * The settings screen's own board: a strip of eight squares driven by the real
 * `PuzzleStore`, so every board preference can be tried where it is chosen. Only the
 * drawing is new; the behaviour underneath is the one the exercises use.
 */
@Component({
	selector: 'app-board-demo',
	templateUrl: './board-demo.component.html',
	styleUrl: './board-demo.component.scss',
	imports: [ChessPieceComponent, ButtonDirective],
	providers: [PuzzleLibraryStore, PuzzleStore],
})
export class BoardDemoComponent {
	readonly store = inject(PuzzleStore);

	private readonly preference = inject(BoardPreferenceService);

	/** The strip always reads a1 to h1, so its slides are measured unflipped. */
	private readonly stripOrientation = signal<PieceColor>('white');

	/** Settled per move, so changing the setting never replays one already on screen. */
	private readonly boardSlide = createBoardSlide({
		transition: this.store.transition,
		animation: this.preference.moveAnimation,
		orientation: this.stripOrientation,
	});

	readonly isClickEnabled = computed(() => this.preference.moveInputMethods().includes('click'));
	readonly isDragEnabled = computed(() => this.preference.moveInputMethods().includes('drag'));

	private readonly gesture = new BoardDragGesture({
		squareAt: (point) => this.squareAt(point),
		pieceAt: (square) => this.store.position().board[ChessSquare.toIndex(square)],
		squareSize: () => this.strip().nativeElement.getBoundingClientRect().width / BOARD_SIZE,
		isClickEnabled: () => this.isClickEnabled(),
		pick: (square) => {
			if (square !== this.store.selected()) {
				this.store.selectSquare(square);
			}
		},
	});

	readonly draggingFrom = this.gesture.draggingFrom;
	readonly ghost = this.gesture.ghost;

	readonly squares = computed<DemoSquare[]>(() =>
		Array.from({ length: BOARD_SIZE }, (_unused, file) => this.describeSquare(file)),
	);

	readonly hint = computed(() => this.describe());

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
			this.store.selectSquare(square.square);
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
		const target = this.gesture.release({ x: event.clientX, y: event.clientY });

		if (undefined !== target) {
			this.store.selectSquare(target);
		}
	}

	cancelDrag(): void {
		this.gesture.cancel();
	}

	label(square: DemoSquare): string {
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
		const element = this.strip().nativeElement;

		if ('function' === typeof (element as { setPointerCapture?: unknown }).setPointerCapture) {
			element.setPointerCapture(pointerId);
		}
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

		return {
			square,
			piece: this.store.position().board[index],
			isLight: ChessSquare.isLight(index),
			isSelected: square === this.store.selected(),
			isTarget: undefined !== target,
			isCapture: undefined !== target?.captured,
			isLastMove: undefined !== lastMove && (square === lastMove.from || square === lastMove.to),
			isMistake: undefined !== mistake && (square === mistake.from || square === mistake.to),
			isAnnounced: square === this.store.announcedMove()?.from,
			slide: this.describeSlide(square),
			// The strip is a board's bottom rank, so it carries that rank's edge: every
			// square names its file, and only the first one names the rank.
			fileLabel: FILES[ChessSquare.fileOf(index)],
			rankLabel: 0 === file ? RANKS[ChessSquare.rowOf(index)] : undefined,
		};
	}

	/** Only the square the move landed on has anything to slide. */
	private describeSlide(square: Square): PieceSlide | undefined {
		const pending = this.boardSlide();

		return square === pending?.to ? pending.slide : undefined;
	}

	private describe(): string {
		if (this.store.isRevealing()) {
			return 'Playing the answer…';
		}

		switch (this.store.outcome()) {
			case 'idle':
			case 'opening':
			case 'replying':
				return 'The rival is moving…';
			case 'failed':
				return 'Not the move — taking it back.';
			case 'solved':
				return 'That was it.';
			case 'solving':
				return 'Take the black rook.';
		}
	}
}
