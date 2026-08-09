import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ChessPosition, Square } from '@app/definition/chess.type';
import { DEFAULT_MOVE_SPEED, MoveSpeed } from '@app/definition/move-speed.type';
import {
	HINT_DELAY_MS,
	PuzzleClosure,
	PuzzleEvent,
	PuzzleResult,
} from '@app/definition/puzzle.type';
import { I18n } from '@app/i18n';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { HINT } from '@app/page/puzzle/store/puzzle/record';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library/puzzle-library.store';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { PuzzleImportUseCase } from '@app/use-case/puzzle-import.use-case';
import { ChessBoard } from '@app/util/chess/chess-board';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessNotation } from '@app/util/chess/chess-notation';

export const HEADER = 'PuzzleId,FEN,Moves,Rating,Popularity,NbPlays,Themes,GameUrl,SelectedFor';
export const MATE_IN_3 =
	'JOGv3,5r2/pp6/2p3k1/2R1p2n/8/1BP5/Pr4PP/5R1K w - - 0 27,f1f8 b2b1 b3d1 b1d1 f8f1 d1f1,536,100,2178,backRankMate endgame long mate mateIn3,https://lichess.org/fFWULcre#53,500-599';
export const MATE_IN_3_FEN = '5r2/pp6/2p3k1/2R1p2n/8/1BP5/Pr4PP/5R1K w - - 0 27';
export const SHORT =
	'ABC12,4k3/8/8/8/8/8/R7/4K2R w - - 0 1,h1h5 e8d8 a2a8,900,90,10,mate mateIn1,https://example.org,900-999';
/** The script walks to mate with Qg4 first, but Qg7 mates straight away. */
export const ALT_MATE =
	'ALT99,7k/p7/7K/8/8/8/8/R5Q1 b - - 0 1,a7a6 g1g4 a6a5 g4g7,700,80,50,mate mateIn2,https://example.org,700-799';

/** Long enough for both beats of the replay: the piece lights up, then it moves. */
export const REPLAY_TOTAL = 1500;
/** One ply of it, so a reveal can be watched a move at a time. */
export const REPLAY_PLY = 800;
/** Long enough for the refuted move to be taken back on its own. */
export const UNDO_TOTAL = 1000;
/** Long enough for the exercise to count as looked at, which is what offers the hint. */
export const HINT_TOTAL = HINT_DELAY_MS;
/**
 * What is left of that clock once `createStore` has returned. The clock starts when the
 * exercise opens, which is inside it, so the opening move it waits out has already been
 * spent — only a test reading the exact moment the hint appears has to care.
 */
export const HINT_REMAINING = HINT_TOTAL - REPLAY_TOTAL * 2;

/** The five plies `playFivePlyLine` leaves behind, as the record writes them. */
export const FIVE_PLY = ['f1f8', 'b2b1', 'b3d1', 'b1d1', 'f8f1'];

/** Imports go nowhere here: persistence is the library store's own concern. */
function createImportStub(): Partial<PuzzleImportUseCase> {
	return {
		import: (name, puzzles) => Promise.resolve({ uuid: name, name, puzzles }),
		findLast: () => Promise.resolve(undefined),
	};
}

/**
 * Every settings-backed service is stubbed whole, so the store is tested against fixed
 * preferences rather than against IndexedDB — and so no test needs an `AudioContext`.
 */
export function configure(speed: MoveSpeed = DEFAULT_MOVE_SPEED): PuzzleStore {
	TestBed.configureTestingModule({
		providers: [
			PuzzleLibraryStore,
			PuzzleStore,
			{ provide: BoardPreferenceService, useValue: { moveSpeed: signal(speed) } },
			{ provide: PuzzleImportUseCase, useValue: createImportStub() },
		],
	});

	return TestBed.inject(PuzzleStore);
}

export function createStore(csv: string, speed: MoveSpeed = DEFAULT_MOVE_SPEED): PuzzleStore {
	const store = configure(speed);

	store.loadCsv(csv, 'Spec set');
	vi.advanceTimersByTime(REPLAY_TOTAL * 2);

	return store;
}

export function play(store: PuzzleStore, from: Square, to: Square): void {
	store.selectSquare(from);
	store.selectSquare(to);
}

/** The first solving move of `MATE_IN_3` is Rb1+; Rc2 is a legal move that is not it. */
export function miss(store: PuzzleStore): void {
	play(store, 'b2', 'c2');
}

/**
 * The tab left for `duration` and then come back to, which is what the page's own
 * visibility handler does to the board. The clock behind the hint is the only thing that
 * hears about it, and time spent away is not time spent looking at the exercise.
 */
export function lookAway(store: PuzzleStore, duration: number): void {
	store.pauseClock();
	vi.advanceTimersByTime(duration);
	store.resumeClock();
}

export function playFivePlyLine(store: PuzzleStore): void {
	play(store, 'b2', 'b1');
	vi.advanceTimersByTime(REPLAY_TOTAL);
	play(store, 'b1', 'd1');
	vi.advanceTimersByTime(REPLAY_TOTAL);
}

export function snapshot(store: PuzzleStore) {
	return { positions: store.positions(), line: store.line(), cursor: store.cursor() };
}

export type LineSnapshot = ReturnType<typeof snapshot>;

export function describeLine(state: LineSnapshot) {
	return {
		fens: state.positions.map((position) => ChessFen.serialize(position)),
		line: state.line.map((move) => ChessNotation.describeLong(move)),
		cursor: state.cursor,
	};
}

/** The moves the scoresheet is showing right now, which stops at the cursor. */
export function sanHistory(store: PuzzleStore): string[] {
	return store.history().map((move) => move.san);
}

/** The three line controls of the solving view, in the order the row lays them out. */
export type NavControl = 'restart' | 'back' | 'forward';

export const NAV_LABELS: Record<NavControl, string> = {
	restart: I18n.common.BOARD_RESTART,
	back: I18n.common.BOARD_STEP_BACKWARD,
	forward: I18n.common.BOARD_STEP_FORWARD,
};

export const NAV_ORDER: readonly NavControl[] = ['restart', 'back', 'forward'];

/**
 * Which of the three the player can press, worked out from the store exactly as the
 * template works it out. `PuzzleSolverComponent`'s own spec holds the two together, so
 * a control that stops matching this is caught there rather than drifting quietly.
 */
export function navControls(store: PuzzleStore): NavControl[] {
	const enabled: NavControl[] = [];

	if (0 !== store.cursor() || store.canStepBackward()) {
		enabled.push('restart');
	}

	if (!store.isBusy() && store.canStepBackward()) {
		enabled.push('back');
	}

	if (!store.isBusy() && store.canStepForward()) {
		enabled.push('forward');
	}

	return enabled;
}

/**
 * What the hint button is doing: still behind its clock, on offer, or already taken.
 * `spent` covers the exercise being over too, since the themes are handed over anyway.
 */
export type HintReading = 'locked' | 'offered' | 'spent';

function readHint(store: PuzzleStore): HintReading {
	if (store.hintUsed()) {
		return 'spent';
	}

	return store.canUseHint() ? 'offered' : 'locked';
}

/** Everything the player can tell about the board at one moment, in one object. */
export interface BoardReading {
	readonly record: readonly PuzzleEvent[];
	readonly cursor: number;
	readonly move: string | undefined;
	readonly canPlay: boolean;
	readonly mistake: string | undefined;
	readonly visible: readonly string[];
	readonly nav: readonly NavControl[];
	readonly hint: HintReading;
	readonly mistakes: number;
	readonly result: PuzzleResult | undefined;
	readonly closure: PuzzleClosure;
}

export function describeBoard(store: PuzzleStore): BoardReading {
	const move = store.lastMove();
	const mistake = store.mistake();

	return {
		record: store.record(),
		cursor: store.cursor(),
		move: undefined === move ? undefined : ChessNotation.describeLong(move),
		canPlay: store.canPlay(),
		mistake: undefined === mistake ? undefined : ChessNotation.describeLong(mistake),
		visible: sanHistory(store),
		nav: navControls(store),
		hint: readHint(store),
		mistakes: store.mistakeCount(),
		result: store.result(),
		closure: store.closure(),
	};
}

interface ReplayState {
	readonly positions: readonly ChessPosition[];
	readonly line: readonly string[];
	readonly cursor: number;
}

/**
 * One event of a main-line record played back onto a board. A `0` is the restart
 * button, which walks the cursor back to the opening move the board plays for itself
 * — it never unwrites the line, so the plies ahead of the cursor are still there to
 * be stepped through. The hint marker moves nothing at all.
 */
function replayStep(state: ReplayState, event: PuzzleEvent): ReplayState {
	if (HINT === event) {
		return state;
	}

	if ('number' === typeof event) {
		const cursor = 0 === event ? Math.min(1, state.line.length) : state.cursor + event;

		return { ...state, cursor };
	}

	const position = state.positions[state.cursor];
	const move = undefined === position ? undefined : ChessNotation.parse(position, event);

	if (undefined === position || undefined === move) {
		throw new Error(`the record does not replay: ${event} at ply ${state.cursor.toString()}`);
	}

	return {
		positions: [...state.positions.slice(0, state.cursor + 1), ChessBoard.apply(position, move)],
		line: [...state.line.slice(0, state.cursor), event],
		cursor: state.cursor + 1,
	};
}

/** Rebuilds the one board a prefix of the record describes, in `describeLine`'s shape. */
export function replayRecord(fen: string, events: readonly PuzzleEvent[]) {
	const state = events.reduce<ReplayState>(replayStep, {
		positions: [ChessFen.parse(fen)],
		line: [],
		cursor: 0,
	});

	return {
		fens: state.positions.map((position) => ChessFen.serialize(position)),
		line: [...state.line],
		cursor: state.cursor,
	};
}
