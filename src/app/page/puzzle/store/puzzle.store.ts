import { DestroyRef, Injectable, inject } from '@angular/core';
import { patchState, signalStore, withState } from '@ngrx/signals';

import { BoardPresenter } from '@app/definition/board-presenter.interface';
import { ChessMove, PromotionPieceType, Square } from '@app/definition/chess.type';
import { Puzzle } from '@app/definition/puzzle.type';
import { withPuzzleComputed } from '@app/page/puzzle/store/puzzle-computed';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library.store';
import {
	buildAttempt,
	buildPuzzleState,
	commitPatch,
	findPromotion,
	isSolution,
	nextSelection,
	openPuzzle,
} from '@app/page/puzzle/store/puzzle-session';
import { ChessNotation } from '@app/util/chess/chess-notation';
import { ScheduledAction } from '@app/util/scheduled-action';

const SCRIPTED_DELAY = 400;

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

	/** Takes back a refuted attempt, or rewinds one ply of the solved line. */
	stepBackward(): void {
		if (undefined !== this.attempt()) {
			patchState(this, { attempt: undefined, selected: undefined, outcome: 'solving' });

			return;
		}

		patchState(this, { cursor: Math.max(0, this.cursor() - 1), selected: undefined });
	}

	stepForward(): void {
		if (undefined !== this.attempt()) {
			return;
		}

		patchState(this, {
			cursor: Math.min(this.line().length, this.cursor() + 1),
			selected: undefined,
		});
	}

	selectSquare(square: Square): void {
		if (!this.isPlayerTurn() || undefined !== this.pendingPromotion()) {
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
			selected: nextSelection(this.position(), square, this.selected(), this.playerColor()),
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

	/** Grades the player's move, then lets the opponent answer if it was right. */
	private attemptMove(move: ChessMove): void {
		const position = this.position();
		const puzzle = this.puzzle();
		const expected = puzzle?.moves[this.cursor()];

		if (!isSolution(position, move, expected)) {
			patchState(this, {
				attempt: buildAttempt(position, move),
				selected: undefined,
				outcome: 'failed',
			});

			return;
		}

		this.commit(move, false);

		const isComplete = this.cursor() >= (puzzle?.moves.length ?? 0);

		patchState(this, { outcome: isComplete ? 'solved' : 'replying' });

		if (!isComplete) {
			this.scheduleScriptedMove();
		}
	}

	private commit(move: ChessMove, isOpponent: boolean): void {
		patchState(
			this,
			commitPatch(
				{ positions: this.positions(), line: this.line(), cursor: this.cursor() },
				this.position(),
				move,
				isOpponent,
			),
		);
	}

	/** Replays the opponent's scripted ply after a short pause. */
	private scheduleScriptedMove(): void {
		this.scheduled.cancel();
		patchState(this, { isReplaying: true });

		this.scheduled.run(() => {
			const expected = this.puzzle()?.moves[this.cursor()];
			const move =
				undefined === expected ? undefined : ChessNotation.parse(this.position(), expected);

			if (undefined !== move) {
				this.commit(move, true);
			}

			// Real Lichess lines end on a player move, but a set that ends on the
			// opponent's would otherwise leave the exercise waiting forever.
			const isComplete = this.cursor() >= (this.puzzle()?.moves.length ?? 0);

			patchState(this, { isReplaying: false, outcome: isComplete ? 'solved' : 'solving' });
		}, SCRIPTED_DELAY);
	}
}
