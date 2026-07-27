import { DestroyRef, Injectable, inject } from '@angular/core';
import { patchState, signalStore, withState } from '@ngrx/signals';

import { nextTransition } from '@app/definition/board-animation.type';
import { BoardPresenter } from '@app/definition/board-presenter.interface';
import { ChessMove, PromotionPieceType, Square } from '@app/definition/chess.type';
import { Puzzle, PuzzleOutcome } from '@app/definition/puzzle.type';
import { withPuzzleComputed } from '@app/page/puzzle/store/puzzle-computed';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library.store';
import {
	buildPuzzleState,
	commitPatch,
	describeOutcome,
	findPromotion,
	isSolution,
	nextSelection,
	openPuzzle,
} from '@app/page/puzzle/store/puzzle-session';
import { ChessNotation } from '@app/util/chess/chess-notation';
import { ScheduledAction } from '@app/util/scheduled-action';

/** Pause before the opponent's piece lights up. */
const REPLAY_DELAY = 300;
/** How long it stays lit before it slides to its destination. */
const ANNOUNCE_DELAY = 450;

@Injectable()
export class PuzzleStore
	extends signalStore({ protectedState: false }, withState(buildPuzzleState), withPuzzleComputed())
	implements BoardPresenter
{
	/** The loaded set and the cursor over it; the template reads it directly. */
	readonly library = inject(PuzzleLibraryStore);

	private readonly scheduled = new ScheduledAction();

	constructor() {
		super();

		inject(DestroyRef).onDestroy(() => {
			this.scheduled.cancel();
		});
	}

	/** Imports exercises from raw CSV text and opens the first one. */
	loadCsv(text: string): boolean {
		const isLoaded = this.library.loadCsv(text);

		if (isLoaded) {
			this.open();
		}

		return isLoaded;
	}

	/** Source-agnostic entry point: feed it rows from a database just as well. */
	setPuzzles(puzzles: readonly Puzzle[]): void {
		this.library.setPuzzles(puzzles);
		this.open();
	}

	selectPuzzle(index: number): void {
		if (this.library.select(index)) {
			this.open();
		}
	}

	nextPuzzle(): void {
		if (this.library.next()) {
			this.open();
		}
	}

	previousPuzzle(): void {
		if (this.library.previous()) {
			this.open();
		}
	}

	restart(): void {
		this.open();
	}

	/**
	 * Rewinds one ply. Stepping back over the move that broke the script puts the
	 * exercise back on the rails, so a wrong move can always be retried.
	 */
	stepBackward(): void {
		const undone = this.line()[this.cursor() - 1];
		const cursor = Math.max(0, this.cursor() - 1);

		patchState(this, {
			cursor,
			selected: undefined,
			outcome: this.outcomeAt(cursor),
			transition:
				undefined === undone ? undefined : nextTransition(this.transition(), undone, 'backward'),
		});
	}

	stepForward(): void {
		const replayed = this.line()[this.cursor()];
		const cursor = Math.min(this.line().length, this.cursor() + 1);

		patchState(this, {
			cursor,
			selected: undefined,
			outcome: this.outcomeAt(cursor),
			transition:
				undefined === replayed ? undefined : nextTransition(this.transition(), replayed, 'forward'),
		});
	}

	selectSquare(square: Square): void {
		if (!this.canPlay() || undefined !== this.pendingPromotion()) {
			return;
		}

		const moves = this.movesFromSelection().filter((move) => square === move.to);
		const [first] = moves;

		if (undefined !== first) {
			if (undefined === first.promotion) {
				this.attemptMove(first);
			} else {
				patchState(this, { pendingPromotion: { from: first.from, to: square } });
			}

			return;
		}

		patchState(this, {
			selected: nextSelection(this.position(), square, this.selected()),
		});
	}

	completePromotion(promotion: PromotionPieceType): void {
		const pending = this.pendingPromotion();

		if (undefined === pending) {
			return;
		}

		const move = findPromotion(this.legalMoves(), pending, promotion);

		patchState(this, { pendingPromotion: undefined });

		if (undefined !== move) {
			this.attemptMove(move);
		}
	}

	cancelPromotion(): void {
		patchState(this, { pendingPromotion: undefined, selected: undefined });
	}

	flipBoard(): void {
		patchState(this, { orientation: 'white' === this.orientation() ? 'black' : 'white' });
	}

	private open(): void {
		const puzzle = this.puzzle();

		this.scheduled.cancel();

		if (undefined === puzzle) {
			patchState(this, buildPuzzleState());

			return;
		}

		patchState(this, openPuzzle(puzzle));
		this.scheduleScriptedMove();
	}

	/**
	 * Grades the player's move, then lets the opponent answer if it was right. A move
	 * that leaves the script is kept anyway: from there the board is played freely,
	 * both sides by hand, until the cursor is rewound back onto the solution.
	 */
	private attemptMove(move: ChessMove): void {
		const position = this.position();
		const puzzle = this.puzzle();
		const expected = puzzle?.moves[this.cursor()];

		if (this.isFreePlay() || !isSolution(position, move, expected)) {
			this.commit(move, position.turn !== this.playerColor());
			patchState(this, { outcome: 'failed' });

			return;
		}

		this.commit(move, false);

		const isComplete = 'solved' === this.outcomeAt(this.cursor());

		patchState(this, { outcome: isComplete ? 'solved' : 'replying' });

		if (!isComplete) {
			this.scheduleScriptedMove();
		}
	}

	private outcomeAt(cursor: number): PuzzleOutcome {
		const puzzle = this.puzzle();

		// A replay in flight owns the outcome until it lands.
		return undefined === puzzle || this.isReplaying()
			? this.outcome()
			: describeOutcome(this.positions(), puzzle, this.deviation(), cursor);
	}

	private commit(move: ChessMove, isOpponent: boolean): void {
		patchState(this, {
			...commitPatch(
				{ positions: this.positions(), line: this.line(), cursor: this.cursor() },
				this.position(),
				move,
				isOpponent,
			),
			transition: nextTransition(this.transition(), move, 'played'),
		});
	}

	/**
	 * Replays the opponent's scripted ply in two beats: the piece lights up on its
	 * own square first, so it can be seen before it slides across the board.
	 */
	private scheduleScriptedMove(): void {
		this.scheduled.cancel();
		patchState(this, { isReplaying: true });

		this.scheduled.run(() => {
			const expected = this.puzzle()?.moves[this.cursor()];
			const move =
				undefined === expected ? undefined : ChessNotation.parse(this.position(), expected);

			patchState(this, { announced: move });
			this.scheduled.run(() => {
				this.replayAnnounced(move);
			}, ANNOUNCE_DELAY);
		}, REPLAY_DELAY);
	}

	private replayAnnounced(move: ChessMove | undefined): void {
		patchState(this, { announced: undefined });

		if (undefined !== move) {
			this.commit(move, true);
		}

		// Real Lichess lines end on a player move, but a set that ends on the
		// opponent's would otherwise leave the exercise waiting forever.
		patchState(this, { isReplaying: false });
		patchState(this, { outcome: this.outcomeAt(this.cursor()) });
	}
}
