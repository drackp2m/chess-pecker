import { WritableSignal, computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';

import { indexAtOrder } from '@app/component/chess-board/board-geometry';
import { ChessBoardComponent } from '@app/component/chess-board/chess-board.component';
import { ChessPieceComponent } from '@app/component/chess-piece/chess-piece.component';
import { BoardTransition, MoveAnimation } from '@app/definition/board-animation.type';
import { MOVE_INPUT_METHODS_ALL } from '@app/definition/board-input.type';
import {
	BOARD_PRESENTER,
	BoardPresenter,
	PendingPromotion,
} from '@app/definition/board-presenter.interface';
import {
	ChessMove,
	ChessMoveRecord,
	ChessPosition,
	PieceColor,
	PromotionPieceType,
	Square,
} from '@app/definition/chess.type';
import { DEFAULT_MOVE_SPEED, MoveSpeed } from '@app/definition/move-speed.type';
import { DEFAULT_MOVE_LIFT } from '@app/definition/piece-lift.constant';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { SoundService } from '@app/service/sound.service';
import { provideTestingI18n } from '@app/testing/i18n.harness';
import { nextTransition } from '@app/util/chess/board-transition';
import { ChessBoard } from '@app/util/chess/chess-board';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessMoveGenerator } from '@app/util/chess/chess-move-generator';
import { ChessNotation } from '@app/util/chess/chess-notation';
import { ChessSquare } from '@app/util/chess/chess-square';

/** One piece on its way, as the board asked the browser to run it. */
export interface SlideReading {
	readonly square: Square;
	readonly transform: string;
}

interface SlideRecord {
	readonly element: Element;
	readonly transform: string;
	readonly duration: number;
	readonly startedAt: number;
	cancelled: boolean;
}

type BoardFixture = ComponentFixture<ChessBoardComponent>;

/**
 * A board driven by hand: real positions and real moves through the stores' own transition
 * builder, grading nothing. It keeps every square the board asked to select.
 */
export class FakeBoardPresenter implements BoardPresenter {
	readonly position: WritableSignal<ChessPosition>;

	readonly orientation = signal<PieceColor>('white');
	readonly playerColor = signal<PieceColor>('white');
	readonly selected = signal<Square | undefined>(undefined);
	readonly history = signal<readonly ChessMoveRecord[]>([]);
	readonly lastMove = signal<ChessMove | undefined>(undefined);
	readonly mistake = signal<ChessMove | undefined>(undefined);
	readonly announcedMove = signal<ChessMove | undefined>(undefined);
	readonly transition = signal<BoardTransition | undefined>(undefined);
	readonly pendingPromotion = signal<PendingPromotion | undefined>(undefined);
	readonly isBusy = signal(false);
	readonly isLocked = signal(false);

	readonly movesFromSelection = computed<readonly ChessMove[]>(() => this.movesFromSelected());

	/** Read off the board the same way the real stores read it, timing included. */
	readonly checkedSquare = computed(() => ChessMoveGenerator.checkedSquare(this.position()));

	readonly picked: Square[] = [];
	readonly promoted: PromotionPieceType[] = [];

	constructor(fen: string) {
		this.position = signal(ChessFen.parse(fen));
	}

	selectSquare(square: Square): void {
		this.picked.push(square);
	}

	completePromotion(piece: PromotionPieceType): void {
		this.promoted.push(piece);
		this.pendingPromotion.set(undefined);
	}

	cancelPromotion(): void {
		this.pendingPromotion.set(undefined);
	}

	/** A move played for real: the position moves on and the board is told how. */
	play(uci: string): void {
		const played = this.position();
		const move = this.moveOf(played, uci);

		this.announcedMove.set(undefined);
		this.selected.set(undefined);
		this.lastMove.set(move);
		this.position.set(ChessBoard.apply(played, move));
		this.transition.set(nextTransition(played, move, 'played'));
	}

	/** The piece lighting up before it travels, which is where a reply really starts. */
	announce(uci: string): void {
		this.announcedMove.set(this.moveOf(this.position(), uci));
	}

	/** The board jumping rather than moving: a restart, a rewind, a new exercise. */
	jumpTo(fen: string): void {
		this.announcedMove.set(undefined);
		this.lastMove.set(undefined);
		this.transition.set(undefined);
		this.position.set(ChessFen.parse(fen));
	}

	private movesFromSelected(): readonly ChessMove[] {
		const from = this.selected();

		return undefined === from
			? []
			: ChessMoveGenerator.movesFrom(this.position(), ChessSquare.toIndex(from));
	}

	private moveOf(position: ChessPosition, uci: string): ChessMove {
		const move = ChessNotation.parse(position, uci);

		if (undefined === move) {
			throw new Error(`${uci} is not legal in ${ChessFen.serialize(position)}`);
		}

		return move;
	}
}

export interface MountedBoard {
	readonly presenter: FakeBoardPresenter;
	play(uci: string): void;
	announce(uci: string): void;
	jumpTo(fen: string): void;
	flip(): void;
	click(square: Square): void;
	advance(duration: number): void;
	/** Draws the board again, for a presenter that was written to directly. */
	render(): void;
	/** What is drawn on a square right now, as `'<colour> <type>'`. */
	pieceAt(square: Square): string | undefined;
	/** The piece that square is losing, still standing under the one taking it. */
	takenAt(square: Square): string | undefined;
	isChecked(square: Square): boolean;
	isAnnounced(square: Square): boolean;
	/** Whether the square is drawn picked up, whoever picked it up. */
	isSelected(square: Square): boolean;
	/** Every square marked as somewhere the piece taken up may go, in square order. */
	targets(): readonly Square[];
	isPromotionOpen(): boolean;
	/** Everything still travelling at this instant, cancelled slides excluded. */
	sliding(): SlideReading[];
	/** How many slides the board has started since it was mounted. */
	slideCount(): number;
	/** Every square the view asked the presenter to act on. */
	picked(): readonly Square[];
}

let originalAnimate: Element['animate'];
let isPatched = false;

/**
 * The test DOM has no Web Animations API, so this stands in and keeps the ledger: what was
 * asked to travel, for how long, and whether anyone called it off.
 */
function spyOnAnimations(): SlideRecord[] {
	const records: SlideRecord[] = [];

	if (!isPatched) {
		originalAnimate = Element.prototype.animate;
		isPatched = true;
	}

	Element.prototype.animate = function (this: Element, keyframes, options): Animation {
		const record: SlideRecord = {
			element: this,
			transform: transformOf(keyframes),
			duration: durationOf(options),
			startedAt: Date.now(),
			cancelled: false,
		};

		records.push(record);

		const stopped = {
			cancel: (): void => {
				record.cancelled = true;
			},
		};

		return stopped as unknown as Animation;
	};

	return records;
}

export function restoreAnimations(): void {
	if (isPatched) {
		Element.prototype.animate = originalAnimate;
		isPatched = false;
	}
}

function transformOf(keyframes: Parameters<Element['animate']>[0]): string {
	const [first] = Array.isArray(keyframes) ? keyframes : [];
	const transform = first?.['transform'];

	return 'string' === typeof transform ? transform : '';
}

function durationOf(options: Parameters<Element['animate']>[1]): number {
	if ('number' === typeof options) {
		return options;
	}

	return 'number' === typeof options?.duration ? options.duration : 0;
}

function isInFlight(record: SlideRecord): boolean {
	return !record.cancelled && Date.now() - record.startedAt < record.duration;
}

function squareElements(fixture: BoardFixture): HTMLButtonElement[] {
	const root = fixture.nativeElement as HTMLElement;

	return [...root.querySelectorAll<HTMLButtonElement>('.square')];
}

function squareElement(
	fixture: BoardFixture,
	presenter: FakeBoardPresenter,
	square: Square,
): HTMLButtonElement | undefined {
	const order = indexAtOrder(ChessSquare.toIndex(square), presenter.orientation());

	return squareElements(fixture)[order];
}

function squareOfElement(
	fixture: BoardFixture,
	presenter: FakeBoardPresenter,
	element: Element,
): Square | undefined {
	const order = squareElements(fixture).findIndex((button) => button.contains(element));

	return -1 === order
		? undefined
		: ChessSquare.fromIndex(indexAtOrder(order, presenter.orientation()));
}

function pieceOn(
	fixture: BoardFixture,
	presenter: FakeBoardPresenter,
	square: Square,
	isTaken: boolean,
): string | undefined {
	const button = squareElement(fixture, presenter, square);
	const view = fixture.debugElement.queryAll(By.directive(ChessPieceComponent)).find((debug) => {
		const element = debug.nativeElement as HTMLElement;

		return true === button?.contains(element) && isTaken === element.classList.contains('taken');
	});
	const piece = view?.componentInstance as ChessPieceComponent | undefined;

	return undefined === piece ? undefined : `${piece.color()} ${piece.type()}`;
}

function inFlight(
	fixture: BoardFixture,
	presenter: FakeBoardPresenter,
	records: readonly SlideRecord[],
): SlideReading[] {
	const readings: SlideReading[] = [];

	for (const record of records) {
		const square = squareOfElement(fixture, presenter, record.element);

		if (isInFlight(record) && undefined !== square) {
			readings.push({ square, transform: record.transform });
		}
	}

	return readings;
}

function markedTargets(fixture: BoardFixture, presenter: FakeBoardPresenter): Square[] {
	const marked = squareElements(fixture).flatMap((button, order) =>
		button.classList.contains('target')
			? [ChessSquare.fromIndex(indexAtOrder(order, presenter.orientation()))]
			: [],
	);

	return marked.sort((left, right) => left.localeCompare(right));
}

function hasClass(
	fixture: BoardFixture,
	presenter: FakeBoardPresenter,
	square: Square,
	name: string,
): boolean {
	return true === squareElement(fixture, presenter, square)?.classList.contains(name);
}

function boardActions(presenter: FakeBoardPresenter, render: () => void) {
	return {
		play: (uci: string): void => {
			presenter.play(uci);
			render();
		},

		announce: (uci: string): void => {
			presenter.announce(uci);
			render();
		},

		jumpTo: (fen: string): void => {
			presenter.jumpTo(fen);
			render();
		},

		flip: (): void => {
			presenter.orientation.set('white' === presenter.orientation() ? 'black' : 'white');
			render();
		},
	};
}

function viewActions(fixture: BoardFixture, presenter: FakeBoardPresenter, render: () => void) {
	return {
		click: (square: Square): void => {
			squareElement(fixture, presenter, square)?.click();
			render();
		},

		advance: (duration: number): void => {
			vi.advanceTimersByTime(duration);
			render();
		},

		render,
	};
}

function actions(fixture: BoardFixture, presenter: FakeBoardPresenter) {
	const render = (): void => {
		fixture.detectChanges();
	};

	return { ...boardActions(presenter, render), ...viewActions(fixture, presenter, render) };
}

function readings(
	fixture: BoardFixture,
	presenter: FakeBoardPresenter,
	records: readonly SlideRecord[],
) {
	const root = fixture.nativeElement as HTMLElement;

	return {
		pieceAt: (square: Square): string | undefined => pieceOn(fixture, presenter, square, false),
		takenAt: (square: Square): string | undefined => pieceOn(fixture, presenter, square, true),
		isChecked: (square: Square): boolean => hasClass(fixture, presenter, square, 'checked'),
		isAnnounced: (square: Square): boolean => hasClass(fixture, presenter, square, 'announced'),
		isSelected: (square: Square): boolean => hasClass(fixture, presenter, square, 'selected'),
		targets: (): readonly Square[] => markedTargets(fixture, presenter),
		isPromotionOpen: (): boolean => null !== root.querySelector('.promotion'),
		sliding: (): SlideReading[] => inFlight(fixture, presenter, records),
		slideCount: (): number => records.length,
		picked: (): readonly Square[] => presenter.picked,
	};
}

function providersFor(presenter: FakeBoardPresenter, animation: MoveAnimation, speed: MoveSpeed) {
	return [
		provideTestingI18n(),
		{ provide: BOARD_PRESENTER, useValue: presenter },
		{
			provide: BoardPreferenceService,
			useValue: {
				moveSpeed: signal(speed),
				moveAnimation: signal(animation),
				moveInputMethods: signal(MOVE_INPUT_METHODS_ALL),
				moveLift: signal(DEFAULT_MOVE_LIFT),
			},
		},
		{ provide: SoundService, useValue: { play: (): void => undefined } },
	];
}

/**
 * The real board against a presenter nobody has to solve an exercise to drive. Everything is
 * read off the DOM, so a test asserts what a player would see.
 */
export function mountBoard(
	fen: string,
	animation: MoveAnimation = 'always',
	speed: MoveSpeed = DEFAULT_MOVE_SPEED,
): MountedBoard {
	const presenter = new FakeBoardPresenter(fen);
	const records = spyOnAnimations();

	TestBed.configureTestingModule({ providers: providersFor(presenter, animation, speed) });

	const fixture = TestBed.createComponent(ChessBoardComponent);

	fixture.detectChanges();

	return { presenter, ...actions(fixture, presenter), ...readings(fixture, presenter, records) };
}
