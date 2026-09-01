import { Signal, computed, inject } from '@angular/core';
import { StateSignals, signalStoreFeature, type, withComputed } from '@ngrx/signals';

import {
	ChessMove,
	ChessPosition,
	MatchStatus,
	PieceColor,
	Square,
} from '@app/definition/chess.type';
import { Puzzle, PuzzleMove, PuzzleRecord } from '@app/definition/puzzle.type';
import { Timeline } from '@app/definition/timeline.type';
import {
	foldFreePlayRun,
	foldRevealed,
	foldScratch,
	foldSession,
} from '@app/page/puzzle/store/puzzle/replay';
import {
	FreePlayAnchor,
	LineState,
	PuzzleStoreProps,
	anchorFreePlay,
	describeProgress,
	findDeviation,
	isPastDeviation,
	mistakeAt,
} from '@app/page/puzzle/store/puzzle/session';
import { projectTimeline } from '@app/page/puzzle/store/puzzle/timeline';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library/puzzle-library.store';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessMoveGenerator } from '@app/util/chess/chess-move-generator';

interface ScriptInput {
	readonly positions: Signal<ChessPosition[]>;
	readonly line: Signal<PuzzleMove[]>;
	readonly cursor: Signal<number>;
	readonly freePlay: Signal<FreePlayAnchor | undefined>;
}

function timelineDerived(
	store: StateSignals<PuzzleStoreProps>,
	record: Signal<PuzzleRecord>,
	puzzle: Signal<Puzzle | undefined>,
): Signal<Timeline> {
	return computed(() =>
		projectTimeline({
			fen: store.fen(),
			record: record(),
			freePlayIndex: store.freePlayIndex(),
			freePlayScratch: store.freePlayScratch(),
			revealed: store.revealed(),
			rewound: store.rewound(),
			puzzle: puzzle(),
		}),
	);
}

/**
 * Where the free-play run on the board was entered from, folded out of the log: leaving free
 * play needs nothing kept, since the main line up to the entry point can be replayed.
 */
function freePlayDerived(
	store: StateSignals<PuzzleStoreProps>,
	record: Signal<PuzzleRecord>,
	puzzle: Signal<Puzzle | undefined>,
): Signal<FreePlayAnchor | undefined> {
	return computed(() => {
		const index = store.freePlayIndex();

		if (undefined === index) {
			return undefined;
		}

		// A log that will not replay takes the anchor with it, so the board degrades to the
		// main line rather than to a sandbox over nothing.
		try {
			return foldFreePlayRun(store.fen(), record(), index, puzzle())?.anchor;
		} catch {
			return undefined;
		}
	});
}

/**
 * The log folded out, stood back by whatever the head holds. `rewound` is the one thing
 * that moves the board without moving the log, clamped so it cannot walk off the front.
 */
function loggedDerived(
	store: StateSignals<PuzzleStoreProps>,
	record: Signal<PuzzleRecord>,
	puzzle: Signal<Puzzle | undefined>,
): Signal<LineState> {
	return computed(() => {
		const logged = foldSession(store.fen(), record(), store.freePlayIndex(), puzzle());
		// The answer goes on before the offset comes off: anchored to the ply it was played
		// from, so the offset walks the whole line instead of dragging the answer behind it.
		const grown = foldRevealed(logged, store.revealed());
		const rewound = store.rewound();

		return 0 === rewound ? grown : { ...grown, cursor: Math.max(0, grown.cursor - rewound) };
	});
}

/**
 * The sandbox a closed exercise plays in, folded onto the board the log left standing. Nothing
 * of it is written down, so it hangs off that board rather than off a stretch of record.
 */
function scratchDerived(
	store: StateSignals<PuzzleStoreProps>,
	logged: Signal<LineState>,
	puzzle: Signal<Puzzle | undefined>,
) {
	const anchor = computed<FreePlayAnchor | undefined>(() =>
		undefined === store.freePlayScratch()
			? undefined
			: anchorFreePlay(logged(), findDeviation(logged(), puzzle())),
	);

	return {
		anchor,

		fold: computed<LineState>(() => {
			const events = store.freePlayScratch();
			const entered = anchor();

			return undefined === events || undefined === entered
				? logged()
				: foldScratch(logged(), events, entered);
		}),
	};
}

/** The log folded out: the line on the board, and the anchor a free-play run hangs off. */
function lineDerived(store: StateSignals<PuzzleStoreProps>, puzzle: Signal<Puzzle | undefined>) {
	const record = computed<PuzzleRecord>(() => ({
		record: store.record(),
		freePlayRuns: store.freePlayRuns(),
	}));

	const scratch = scratchDerived(store, loggedDerived(store, record, puzzle), puzzle);
	const fold = scratch.fold;
	const recorded = freePlayDerived(store, record, puzzle);

	return {
		positions: computed(() => fold().positions),
		line: computed(() => fold().line),
		cursor: computed(() => fold().cursor),

		timeline: timelineDerived(store, record, puzzle),
		freePlay: computed(() => scratch.anchor() ?? recorded()),
	};
}

interface SessionInput {
	readonly announced: Signal<ChessMove | undefined>;
	readonly isReplaying: Signal<boolean>;
	readonly cursor: Signal<number>;
	readonly playerColor: Signal<PieceColor>;
}

function playbackDerived(store: StateSignals<PuzzleStoreProps>) {
	return {
		isReplaying: computed(() => undefined !== store.playback()),
		isRevealing: computed(() => 'reveal' === store.playback()),
	};
}

/** What the board offers from the position on screen, script aside. */
function boardComputed(position: Signal<ChessPosition>, selected: Signal<Square | undefined>) {
	const legalMoves = computed(() => ChessMoveGenerator.legalMoves(position()));

	return {
		legalMoves,

		movesFromSelection: computed(() => {
			const current = selected();

			return undefined === current ? [] : legalMoves().filter((move) => current === move.from);
		}),

		checkedSquare: computed<Square | undefined>(() => ChessMoveGenerator.checkedSquare(position())),
	};
}

/** Where the line stands against the script, which free play freezes for as long as it lasts. */
function scriptComputed(store: ScriptInput, puzzle: Signal<Puzzle | undefined>) {
	const played = computed(() =>
		findDeviation({ positions: store.positions(), line: store.line() }, puzzle()),
	);

	const deviation = computed(() => {
		const anchor = store.freePlay();

		return undefined === anchor ? played() : anchor.deviation;
	});

	return {
		deviation,

		isFreePlay: computed(() => undefined !== store.freePlay()),

		/**
		 * The cursor stands behind everything the exercise reached, and that line is not
		 * writable: a move played into it would drop the plies ahead of the cursor.
		 */
		isBehindLine: computed(() => store.cursor() < (deviation() ?? store.line().length)),

		/** The position on screen is one the script has nothing to say about. */
		isOffScript: computed(() => isPastDeviation(deviation(), store.cursor())),

		/** How far the exercise itself got, which free play leaves where it found it. */
		scriptCursor: computed(() => Math.min(store.cursor(), store.freePlay()?.cursor ?? Infinity)),
	};
}

/** The scoresheet: what has been played, and where in it the cursor is standing. */
function lineComputed(
	line: Signal<PuzzleMove[]>,
	cursor: Signal<number>,
	script: { deviation: Signal<number | undefined>; isFreePlay: Signal<boolean> },
) {
	return {
		/** Only the moves up to the cursor, so stepping back shortens the scoresheet. */
		history: computed(() => line().slice(0, cursor())),

		lastMove: computed<ChessMove | undefined>(() => line()[cursor() - 1]),

		/**
		 * The move that broke the script, while it is still the last on the board. An
		 * free-play run has no script to break, so nothing inside one is ever a mistake.
		 */
		mistake: computed<ChessMove | undefined>(() =>
			script.isFreePlay() ? undefined : mistakeAt(line(), cursor(), script.deviation()),
		),

		canStepBackward: computed(() => 0 < cursor()),
		canStepForward: computed(() => cursor() < line().length),
	};
}

/** How the exercise is going: what is being replayed, and how far along the script it is. */
function sessionComputed(
	puzzle: Signal<Puzzle | undefined>,
	store: SessionInput,
	script: { deviation: Signal<number | undefined>; scriptCursor: Signal<number> },
) {
	return {
		announcedMove: computed(() => store.announced()),

		isBusy: computed(() => store.isReplaying()),

		progress: computed(() =>
			describeProgress(script.scriptCursor(), puzzle(), store.playerColor(), script.deviation()),
		),
	};
}

/**
 * Free play is a real game, so it gets a real verdict; an exercise is graded against its
 * script and stays `undefined`.
 */
// ToDo => pin down in a test what stepping backwards does here: a rewind shortens the
// history so a repetition stops counting, while the match board destroys it for good.
function freePlayComputed(
	position: Signal<ChessPosition>,
	positions: Signal<ChessPosition[]>,
	cursor: Signal<number>,
	isFreePlay: Signal<boolean>,
): Signal<MatchStatus | undefined> {
	return computed(() =>
		isFreePlay()
			? ChessMoveGenerator.status(position(), positions().slice(0, cursor()))
			: undefined,
	);
}

/** The pieces every computed below is built out of, folded once and shared. */
function puzzleDerived(store: StateSignals<PuzzleStoreProps>) {
	const puzzle = inject(PuzzleLibraryStore).current;

	const { positions, line, cursor, freePlay, timeline } = lineDerived(store, puzzle);
	const { scriptCursor, ...script } = scriptComputed({ positions, line, cursor, freePlay }, puzzle);

	return {
		puzzle,
		positions,
		line,
		cursor,
		freePlay,
		timeline,
		script,
		scriptCursor,
		playback: playbackDerived(store),
		position: computed(() => positions()[cursor()] ?? ChessFen.initial()),
	};
}

function puzzleComputed(store: StateSignals<PuzzleStoreProps>) {
	const derived = puzzleDerived(store);
	const { puzzle, positions, line, cursor, freePlay, timeline } = derived;
	const { script, scriptCursor, playback, position } = derived;

	return {
		puzzle,
		position,
		positions,
		line,
		cursor,
		freePlay,
		timeline,

		isPlayerTurn: computed(
			() => 'solving' === store.outcome() && position().turn === store.playerColor(),
		),

		isBoardFlipped: computed(() => store.orientation() !== store.playerColor()),

		freePlayStatus: freePlayComputed(position, positions, cursor, script.isFreePlay),

		...playback,
		...script,
		...boardComputed(position, store.selected),
		...lineComputed(line, cursor, script),
		...sessionComputed(puzzle, { ...store, ...playback, cursor }, { ...script, scriptCursor }),
	};
}

/** Everything the store derives rather than stores, so the class holds only commands. */
export function withPuzzleComputed() {
	return signalStoreFeature({ state: type<PuzzleStoreProps>() }, withComputed(puzzleComputed));
}
