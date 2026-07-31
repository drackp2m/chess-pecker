import { Signal, computed, inject } from '@angular/core';
import { signalStoreFeature, type, withComputed } from '@ngrx/signals';

import { ChessMove, ChessPosition, PieceColor, Square } from '@app/definition/chess.type';
import { Puzzle, PuzzleMove } from '@app/definition/puzzle.type';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library.store';
import {
	FreePlayAnchor,
	PuzzleStoreProps,
	describeProgress,
	findDeviation,
	isPastDeviation,
	mistakeAt,
} from '@app/page/puzzle/store/puzzle-session';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessMoveGenerator } from '@app/util/chess/chess-move-generator';

interface ScriptInput {
	readonly positions: Signal<ChessPosition[]>;
	readonly line: Signal<PuzzleMove[]>;
	readonly cursor: Signal<number>;
	readonly freePlay: Signal<FreePlayAnchor | undefined>;
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
	deviation: Signal<number | undefined>,
) {
	return {
		/** Only the moves up to the cursor, so stepping back shortens the scoresheet. */
		history: computed(() => line().slice(0, cursor())),

		lastMove: computed<ChessMove | undefined>(() => line()[cursor() - 1]),

		mistake: computed<ChessMove | undefined>(() => mistakeAt(line(), cursor(), deviation())),

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
 * Everything the puzzle store derives rather than stores. Split off as a signal
 * store feature so the store class itself is left holding only commands.
 */
export function withPuzzleComputed() {
	return signalStoreFeature(
		{ state: type<PuzzleStoreProps>() },
		withComputed((store) => {
			const puzzle = inject(PuzzleLibraryStore).current;

			const position = computed(() => store.positions()[store.cursor()] ?? ChessFen.initial());

			const { scriptCursor, ...script } = scriptComputed(store, puzzle);

			const isPlayerTurn = computed(
				() => 'solving' === store.outcome() && position().turn === store.playerColor(),
			);

			return {
				puzzle,
				position,
				isPlayerTurn,

				...script,
				...boardComputed(position, store.selected),
				...lineComputed(store.line, store.cursor, script.deviation),
				...sessionComputed(puzzle, store, { ...script, scriptCursor }),
			};
		}),
	);
}
