import { Injectable, inject } from '@angular/core';
import { patchState, signalStore, withState } from '@ngrx/signals';

import { nextTransition } from '@app/definition/board-animation.type';
import { BoardPresenter } from '@app/definition/board-presenter.interface';
import { ChessMove, PromotionPieceType, Square } from '@app/definition/chess.type';
import {
	Puzzle,
	PuzzleOutcome,
	PuzzleRecord,
	settleClosure,
	settleResult,
} from '@app/definition/puzzle.type';
import { withPuzzleComputed } from '@app/page/puzzle/store/puzzle/computed';
import { withPuzzleGating } from '@app/page/puzzle/store/puzzle/gating';
import { withPuzzlePlayback } from '@app/page/puzzle/store/puzzle/playback';
import {
	RecordState,
	recordEntry,
	recordRestart,
	recordStep,
} from '@app/page/puzzle/store/puzzle/record';
import {
	PuzzleVerdict,
	anchorFreePlay,
	buildPuzzleState,
	findPromotion,
	isSolution,
	nextSelection,
	openPuzzle,
	restartLinePatch,
	restoreFreePlayPatch,
	revealPatch,
} from '@app/page/puzzle/store/puzzle/session';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library/puzzle-library.store';
import { SoundService } from '@app/service/sound.service';

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

	private readonly sound = inject(SoundService);

	/** Imports exercises from raw CSV text and opens the first one. */
	loadCsv(text: string, name: string): boolean {
		const isLoaded = this.library.loadCsv(text, name);

		if (isLoaded) {
			this.open();
		}

		return isLoaded;
	}

	/** Reopens the last imported set, so a reload does not lose it. */
	async restore(): Promise<void> {
		if (0 < (await this.library.restore()).length) {
			this.open();
		}
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

	/** Same exercise, so what it was graded and closed on survives the reopening. */
	restart(): void {
		const puzzle = this.puzzle();
		// Read before anything moves, so the restart is written into the record the
		// exercise already had instead of the blank one reopening it would hand out.
		const recorded = recordRestart(this.recordState());

		if (undefined === this.freePlay() || undefined === puzzle) {
			this.open(this.verdict(), recorded);

			return;
		}

		patchState(this, restartLinePatch(puzzle), recorded);
		this.playScripted();
	}

	/**
	 * Gives up: plays what is left of the solution, from wherever the line stopped
	 * following it. It ends the exercise, though not the verdict — that was settled on
	 * the first try, and watching never revises it. Asked for again once the exercise is
	 * over there is nothing left ahead, so it rewinds to the start and plays the whole
	 * line out; the record is closed by then and takes none of it.
	 */
	revealSolution(): void {
		if (!this.canRevealSolution()) {
			return;
		}

		this.cancelPlayback();
		patchState(this, (state) => revealPatch(state, this.isOpen() ? this.deviation() : 0));
		this.playScripted();
	}

	/** Uncovers the themes. It is help, so it is remembered, but it closes nothing. */
	useHint(): void {
		if (!this.canUseHint()) {
			return;
		}

		patchState(this, { hintUsed: true });
	}

	toggleFreePlay(): void {
		this.stopReveal();

		const anchor = this.freePlay();

		if (undefined === anchor) {
			this.settleScripted();
			this.enterFreePlay();

			return;
		}

		this.cancelScripted();
		patchState(this, (state) => restoreFreePlayPatch(state, anchor));
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

	private open(verdict?: PuzzleVerdict, recorded?: PuzzleRecord): void {
		const puzzle = this.puzzle();

		this.cancelPlayback();

		if (undefined === puzzle) {
			patchState(this, buildPuzzleState());

			return;
		}

		patchState(this, { ...openPuzzle(puzzle), ...recorded, ...verdict });
		this.playScripted();
	}

	private lineState() {
		return { positions: this.positions(), line: this.line(), cursor: this.cursor() };
	}

	private verdict(): PuzzleVerdict {
		return {
			result: this.result(),
			closure: this.closure(),
			hintUsed: this.hintUsed(),
			mistakeCount: this.mistakeCount(),
		};
	}

	private recordState(): RecordState {
		return {
			record: this.record(),
			explorations: this.explorations(),
			freePlay: this.freePlay(),
			closure: this.closure(),
		};
	}

	private enterFreePlay(): void {
		patchState(this, recordEntry, {
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
		// What the cursor really did, which the clamped callers may have cut short.
		const step = cursor - this.cursor();

		patchState(this, (state) => recordStep(state, step), {
			cursor,
			selected: undefined,
			outcome,
			result: settleResult(this.result(), outcome),
			// Nothing to step over means the cursor stayed put, so whatever the board is
			// showing still stands and must not be cleared out from under it.
			...(undefined === stepped ? {} : { transition: nextTransition(stepped, kind) }),
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
	 *
	 * The move that completes the line is also the one that ends the exercise, whether
	 * it was found first time or after any number of misses.
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

		patchState(this, {
			outcome,
			result: settleResult(this.result(), outcome),
			closure: 'solved' === outcome ? settleClosure(this.closure(), 'found') : this.closure(),
		});

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
		this.commit(move, false);
		patchState(this, {
			outcome: 'failed',
			result: settleResult(this.result(), 'failed'),
			mistakeCount: this.mistakeCount() + 1,
		});

		this.scheduleUndo(() => {
			this.stepBackward();
		});
	}
}
