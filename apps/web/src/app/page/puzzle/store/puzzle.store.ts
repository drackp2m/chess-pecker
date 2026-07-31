import { Injectable, inject } from '@angular/core';
import { patchState, signalStore, withState } from '@ngrx/signals';

import { nextTransition } from '@app/definition/board-animation.type';
import { BoardPresenter } from '@app/definition/board-presenter.interface';
import { ChessMove, PromotionPieceType, Square } from '@app/definition/chess.type';
import { Puzzle, PuzzleOutcome, PuzzleResult, settleResult } from '@app/definition/puzzle.type';
import { withPuzzleComputed } from '@app/page/puzzle/store/puzzle-computed';
import { withPuzzleGating } from '@app/page/puzzle/store/puzzle-gating';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library.store';
import { withPuzzlePlayback } from '@app/page/puzzle/store/puzzle-playback';
import {
	anchorFreePlay,
	buildPuzzleState,
	findPromotion,
	isSolution,
	nextSelection,
	openPuzzle,
	restoreFreePlayPatch,
	revealPatch,
} from '@app/page/puzzle/store/puzzle-session';
import { MistakePolicyService } from '@app/service/mistake-policy.service';
import { SoundService } from '@app/service/sound.service';

// ToDo => Woodpecker needs a clock, and nothing here measures time. The method is
// scored on how long a cycle takes, so a session needs: when the exercise became
// solvable (`outcome` reaching `'solving'`), when it was solved, how long the tab was
// hidden in between (`visibilitychange`, otherwise a backgrounded tab inflates every
// time), and whether the first attempt was correct — `result` now knows that much.
// Capture the rest in the state built by `buildPuzzleState`, keep it out of the
// animation timers, and hand it to a use-case that writes an attempt row.
//
// ToDo => an attempt is also lost on navigation: the store is provided by
// `PuzzlePage`, so leaving the page destroys the session with no flush.

@Injectable()
export class PuzzleStore
	extends signalStore(
		{ protectedState: false },
		withState(buildPuzzleState),
		withPuzzleComputed(),
		withPuzzleGating(),
		withPuzzlePlayback(),
	)
	implements BoardPresenter
{
	/** The loaded set and the cursor over it; the template reads it directly. */
	readonly library = inject(PuzzleLibraryStore);

	/** How many misses it takes for the answer to play itself, chosen in the settings. */
	private readonly policy = inject(MistakePolicyService).policy;

	private readonly sound = inject(SoundService);

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

	/** Same exercise, so the verdict it was graded on survives the reopening. */
	restart(): void {
		this.open(this.result());
	}

	/**
	 * Plays what is left of the solution, from wherever the line stopped following it.
	 * The result was settled on the first try, so watching the answer never revises it.
	 */
	revealSolution(): void {
		if (!this.canRevealSolution()) {
			return;
		}

		this.cancelPlayback();
		patchState(this, revealPatch(this.lineState(), this.deviation()));
		this.playScripted();
	}

	toggleFreePlay(): void {
		this.stopReveal();

		const anchor = this.freePlay();

		if (undefined === anchor) {
			this.enterFreePlay();

			return;
		}

		patchState(this, restoreFreePlayPatch(anchor));
	}

	/**
	 * Rewinds one ply. Stepping back over the move that broke the script puts the
	 * exercise back on the rails, so a wrong move can always be tried again.
	 */
	stepBackward(): void {
		this.stopReveal();

		const undone = this.line()[this.cursor() - 1];

		this.moveCursor(Math.max(0, this.cursor() - 1), undone, 'backward');
	}

	stepForward(): void {
		this.stopReveal();

		const replayed = this.line()[this.cursor()];

		this.moveCursor(Math.min(this.line().length, this.cursor() + 1), replayed, 'forward');
	}

	selectSquare(square: Square): void {
		this.stopReveal();

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

	private open(result?: PuzzleResult): void {
		const puzzle = this.puzzle();

		this.cancelPlayback();

		if (undefined === puzzle) {
			patchState(this, buildPuzzleState());

			return;
		}

		patchState(this, { ...openPuzzle(puzzle), result });
		this.playScripted();
	}

	private lineState() {
		return { positions: this.positions(), line: this.line(), cursor: this.cursor() };
	}

	private enterFreePlay(): void {
		patchState(this, {
			freePlay: anchorFreePlay(this.lineState(), this.deviation()),
			selected: undefined,
			pendingPromotion: undefined,
		});
	}

	private stopReveal(): void {
		if (!this.isRevealing()) {
			return;
		}

		this.cancelPlayback();
		patchState(this, { isReplaying: false, isRevealing: false, announced: undefined });
		patchState(this, { outcome: this.outcomeAt(this.cursor()) });
	}

	/** Both steppers land here, so the verdict is read the same way either way. */
	private moveCursor(
		cursor: number,
		stepped: ChessMove | undefined,
		kind: 'backward' | 'forward',
	): void {
		const outcome = this.outcomeAt(cursor);
		const previous = this.position();

		patchState(this, {
			cursor,
			selected: undefined,
			outcome,
			result: settleResult(this.result(), outcome),
			transition:
				undefined === stepped ? undefined : nextTransition(this.transition(), stepped, kind),
		});

		if (undefined !== stepped) {
			// The move is judged from the position that has it on the board: stepping
			// forward lands on it, stepping back is leaving it behind.
			this.sound.playMove('backward' === kind ? previous : this.position(), stepped, kind);
		}
	}

	/**
	 * Grades the player's move, then lets the opponent answer if it was right. Only a
	 * move played against the script is graded at all: off it, and in free play, the
	 * board is a sandbox and nothing there may reach `result`.
	 */
	private attemptMove(move: ChessMove): void {
		if (this.isFreePlay() || this.isOffScript()) {
			this.playFreely(move);

			return;
		}

		if (!isSolution(this.position(), move, this.puzzle()?.moves[this.cursor()])) {
			this.registerMistake(move);

			return;
		}

		this.commit(move, false);

		const outcome: PuzzleOutcome =
			'solved' === this.outcomeAt(this.cursor()) ? 'solved' : 'replying';

		patchState(this, { outcome, result: settleResult(this.result(), outcome) });

		if ('solved' !== outcome) {
			this.playScripted();
		}
	}

	private playFreely(move: ChessMove): void {
		const isOpponent = this.position().turn !== this.playerColor();

		if (!this.isFreePlay()) {
			this.enterFreePlay();
		}

		this.commit(move, isOpponent);
	}

	/**
	 * The take-back and the answer that may follow it share one pending timeout on
	 * purpose: only the last one scheduled survives, so two would cancel each other.
	 */
	private registerMistake(move: ChessMove): void {
		const count = this.mistakeCount() + 1;

		this.commit(move, false);
		patchState(this, {
			outcome: 'failed',
			result: settleResult(this.result(), 'failed'),
			mistakeCount: count,
		});

		this.scheduleUndo(() => {
			this.stepBackward();
			this.playSolutionIfDue(count);
		});
	}

	private playSolutionIfDue(count: number): void {
		const threshold = this.policy().mistakesBeforeSolution;

		if (0 < threshold && count >= threshold) {
			this.revealSolution();
		}
	}
}
