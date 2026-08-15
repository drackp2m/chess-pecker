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
import { foldExploration, foldRevealed, foldSession } from '@app/page/puzzle/store/puzzle/replay';
import {
	FreePlayAnchor,
	LineState,
	PuzzleStoreProps,
	describeProgress,
	findDeviation,
	isPastDeviation,
	mistakeAt,
} from '@app/page/puzzle/store/puzzle/session';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library/puzzle-library.store';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessMoveGenerator } from '@app/util/chess/chess-move-generator';

interface ScriptInput {
	readonly positions: Signal<ChessPosition[]>;
	readonly line: Signal<PuzzleMove[]>;
	readonly cursor: Signal<number>;
	readonly freePlay: Signal<FreePlayAnchor | undefined>;
}

/** The log folded out: the line on the board, and the anchor an exploration hangs off. */
function lineDerived(store: StateSignals<PuzzleStoreProps>, puzzle: Signal<Puzzle | undefined>) {
	const record = computed<PuzzleRecord>(() => ({
		record: store.record(),
		explorations: store.explorations(),
	}));

	/**
	 * The log folded out, stood back by whatever the animation is holding. `rewound` is
	 * the one thing that moves the board without moving the log, and it is clamped so a
	 * beat left over can never walk the cursor off the front of the line.
	 */
	const fold = computed<LineState>(() => {
		const logged = foldSession(store.fen(), record(), store.freePlayIndex(), puzzle());
		const rewound = store.rewound();

		// The offset comes off the log's own cursor first, because it is what says where
		// the board really is standing — and the answer that follows is played from there,
		// onto the line, exactly as if it had been played by hand.
		const stood =
			0 === rewound ? logged : { ...logged, cursor: Math.max(0, logged.cursor - rewound) };

		return foldRevealed(stood, store.revealed());
	});

	return {
		positions: computed(() => fold().positions),
		line: computed(() => fold().line),
		cursor: computed(() => fold().cursor),

		/**
		 * Where the exploration on the board was entered from. It is folded out of the log
		 * like everything else, so leaving free play needs nothing to have been kept: the
		 * main line up to the entry point is still there to be replayed.
		 */
		freePlay: computed(() => {
			const index = store.freePlayIndex();

			if (undefined === index) {
				return undefined;
			}

			// A log that will not replay takes the anchor with it, and free play with it:
			// the board degrades to the main line rather than to a sandbox over nothing.
			try {
				return foldExploration(store.fen(), record(), index, puzzle())?.anchor;
			} catch {
				return undefined;
			}
		}),
	};
}

interface SessionInput {
	readonly announced: Signal<ChessMove | undefined>;
	readonly isReplaying: Signal<boolean>;
	readonly cursor: Signal<number>;
	readonly playerColor: Signal<PieceColor>;
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
		 * The cursor is standing behind everything the exercise has reached, which is the
		 * solved line and, if there is one, the last move that was tried on the end of it.
		 * The line from here on is a record of what happened and is not writable: a move
		 * played into it would drop the plies ahead of the cursor, and those are the ones
		 * that must never be taken away from the player again.
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
		 * The move that broke the script, while it is still the last one on the board.
		 * An exploration has no script to break — either side may be played there, and
		 * changing the line is what it is for — so nothing inside one is ever a mistake.
		 * Check and mate go on showing: those are the board's own and not the exercise's.
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
 * Free play is a real game on this board, so it gets a real verdict — `undefined` while
 * the exercise is being solved, which is graded against its script and has nothing to say
 * about mate or a draw. The positions before the cursor are the history, exactly as the
 * match store keeps it.
 */
// ToDo => nothing covers what stepping backwards does to this. Both halves depend on
// `cursor`, so rewinding re-judges the position on screen — which is what it should do —
// but it also shortens the history, so a threefold repetition stops counting when you step
// back over it and counts again when you step forward. That reads as coherent (the verdict
// of the position shown, from what was played up to it) and it is where the two boards
// diverge: the match rewinds by *destroying* history in `undoLastMove`, so there a
// repetition undone is gone for good. Pin whichever is wanted down in a test before either
// one is taken for granted.
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

/**
 * Everything the puzzle store derives rather than stores. Split off as a signal
 * store feature so the store class itself is left holding only commands.
 */
export function withPuzzleComputed() {
	return signalStoreFeature(
		{ state: type<PuzzleStoreProps>() },
		withComputed((store) => {
			const puzzle = inject(PuzzleLibraryStore).current;

			const { positions, line, cursor, freePlay } = lineDerived(store, puzzle);

			const position = computed(() => positions()[cursor()] ?? ChessFen.initial());

			const { scriptCursor, ...script } = scriptComputed(
				{ positions, line, cursor, freePlay },
				puzzle,
			);

			return {
				puzzle,
				position,
				positions,
				line,
				cursor,
				freePlay,

				isPlayerTurn: computed(
					() => 'solving' === store.outcome() && position().turn === store.playerColor(),
				),

				freePlayStatus: freePlayComputed(position, positions, cursor, script.isFreePlay),

				...script,
				...boardComputed(position, store.selected),
				...lineComputed(line, cursor, script),
				...sessionComputed(puzzle, { ...store, cursor }, { ...script, scriptCursor }),
			};
		}),
	);
}
