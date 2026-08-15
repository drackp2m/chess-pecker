import { Injectable, inject } from '@angular/core';
import { patchState, signalStore, withState } from '@ngrx/signals';

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
import { PuzzleAction, RecordState, append } from '@app/page/puzzle/store/puzzle/record';
import {
	PuzzleRestore,
	PuzzleStoreProps,
	PuzzleVerdict,
	buildPuzzleState,
	findPromotion,
	isSolution,
	nextSelection,
	openPuzzle,
	restoreFreePlayPatch,
	restorePatch,
	restoredTransition,
	revealCursor,
	revealPatch,
} from '@app/page/puzzle/store/puzzle/session';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library/puzzle-library.store';
import { nextTransition } from '@app/util/chess/board-transition';

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

	/**
	 * Back to the board the exercise opened on. It is a way of looking at the line and
	 * nothing more — the line is left whole, and the exercise is picked up again by
	 * stepping forward to where it had got to.
	 *
	 * Inside an exploration the line left standing is the main one it was entered from,
	 * so the sandbox is thrown away and the exercise really does start over; what is put
	 * back is only what was visible of it, never the actions that got there.
	 */
	restart(): void {
		const puzzle = this.puzzle();

		if (undefined === puzzle) {
			// Written before anything moves, so the restart goes into the record the
			// exercise already had instead of the blank one reopening it would hand out.
			this.open(this.verdict(), append(this.recordState(), { kind: 'restart' }));

			return;
		}

		// The sandbox stays open — starting the exercise over is not leaving it — so the
		// restart is written inside the exploration, which is where the board is.
		this.append({ kind: 'restart' });
		this.rewindToStart();
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

		const wasOpen = this.isOpen();
		const cursor = revealCursor(this.lineState(), wasOpen ? this.deviation() : 0);
		// The slide is judged against the cursor as it stands now, which is what it
		// describes; the rewind is about to move it.
		const rewind = { cursor: this.cursor(), transition: this.transition() };

		// While the exercise is open the rewind onto the script has to be written into the
		// log before the record closes, or the log would end on a board the line is no
		// longer standing on.
		if (wasOpen) {
			this.seek(cursor);
		}

		patchState(this, revealPatch({ ...rewind, closure: this.closure() }, cursor));

		// Asked for again once it was already over, nothing is left ahead, so the whole line
		// is played out from the board the exercise opened on. Anchoring the answer there is
		// all it takes to stand the board back: the head follows the answer, not the log.
		if (!wasOpen) {
			patchState(this, { revealed: { at: 0, moves: [] } });
		}

		this.playScripted();
	}

	/**
	 * Puts a saved exercise back on the board, exactly as it was left. It is the board the
	 * record describes, so nothing here is played: the playback in flight is dropped, the
	 * line is folded out of the record in one go and the cursor lands where it stood.
	 *
	 * The move the line is standing on is the one thing that travels, so what changed while
	 * the page was away can be seen — a slide and nothing more, with no beat of its own and
	 * nothing following it.
	 *
	 * A record that does not replay is not worth an empty board on top of a solved
	 * exercise, so it degrades to the position the exercise opened on and the exercise is
	 * simply begun again; the verdict it carries still stands.
	 */
	restoreFrom(stored: PuzzleRestore): void {
		const puzzle = this.puzzle();

		if (undefined === puzzle) {
			return;
		}

		this.cancelPlayback();
		patchState(this, restorePatch(stored, this.playerColor()));

		// Read after the log is in: the line it describes is what the slide travels along.
		patchState(this, { transition: restoredTransition(this.lineState()) });
		patchState(this, { outcome: this.outcomeAt(this.cursor()) });
	}

	/**
	 * Uncovers the themes. It is help, so it is remembered and written down where it was
	 * asked for — the main line, or the exploration that was open at the time — but it
	 * closes nothing. It cannot be asked for at all until the exercise has been looked at
	 * for `HINT_DELAY_MS`.
	 */
	useHint(): void {
		if (!this.canUseHint()) {
			return;
		}

		this.append({ kind: 'hint' }, { hintUsed: true });
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
		// Letting go of the index puts the main line back on the board on its own, and it
		// comes back standing exactly where the exploration was entered from.
		patchState(
			this,
			restoreFreePlayPatch({ cursor: this.cursor(), transition: this.transition() }, anchor),
		);
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
		this.armHintGate();
		this.playScripted();
	}

	private lineState() {
		return { positions: this.positions(), line: this.line(), cursor: this.cursor() };
	}

	/**
	 * The user did something new. It goes on the end of the log and the cursor follows it
	 * there; the guard that used to sit on every writer separately lives inside `append`,
	 * so a closed exercise takes none of this.
	 */
	private append(action: PuzzleAction, patch?: Partial<PuzzleStoreProps>): void {
		patchState(this, (state) => append(state, action), patch ?? {});
	}

	/**
	 * Moves the head over what already exists. It never writes a move — only the step it
	 * took, which is what lets the log replay back to this very board — and a seek that
	 * goes nowhere writes nothing at all.
	 *
	 * A closed exercise is still there to be looked through, but its record is sealed and
	 * takes no more steps, so the cursor travels beside the log instead of inside it.
	 */
	private seek(cursor: number, patch?: Partial<PuzzleStoreProps>): void {
		const clamped = Math.max(0, Math.min(this.line().length, cursor));

		if ('open' !== this.closure()) {
			patchState(this, { rewound: this.rewound() + this.cursor() - clamped }, patch ?? {});

			return;
		}

		this.append({ kind: 'step', step: clamped - this.cursor() }, patch);
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
			freePlayIndex: this.freePlayIndex(),
			closure: this.closure(),
		};
	}

	/**
	 * Opens a sandbox on the end of the log. The anchor it hangs off is not captured — the
	 * entry event records where the main line stood, and the fold works the rest out — so
	 * all that is held is which exploration is the open one.
	 */
	private enterFreePlay(): void {
		const opened = this.explorations().length;

		this.append({ kind: 'entry' });

		// A closed record takes no entry, and an index pointing at an exploration that was
		// never written would fold to nothing at all. The sandbox opens only if it is there.
		if (opened < this.explorations().length) {
			patchState(this, {
				freePlayIndex: opened,
				selected: undefined,
				pendingPromotion: undefined,
			});
		}
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
		// The board the stepped move was played on, whichever way it is travelled: it
		// is the lower of the two cursors the move sits between.
		const played = this.positions()[Math.min(cursor, this.cursor())];

		this.seek(cursor, {
			selected: undefined,
			outcome,
			result: settleResult(this.result(), outcome),
			// Nothing to step over means the cursor stayed put, so whatever the board is
			// showing still stands and must not be cleared out from under it.
			...(undefined === stepped || undefined === played
				? {}
				: { transition: nextTransition(played, stepped, kind) }),
		});
	}

	/**
	 * Grades the player's move, then lets the opponent answer if it was right. Only a
	 * move played against the script is graded at all: in free play the board is a
	 * sandbox and nothing there may reach `result`, which is also the only place both
	 * sides are the player's to move.
	 *
	 * The move that completes the line is also the one that ends the exercise, whether
	 * it was found first time or after any number of misses.
	 */
	private attemptMove(move: ChessMove): void {
		if (this.isFreePlay()) {
			this.commit(move);

			return;
		}

		if (!isSolution(this.position(), move, this.puzzle()?.moves[this.cursor()])) {
			this.registerMistake(move);

			return;
		}

		this.commit(move);

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

	/**
	 * The take-back and the answer that may follow it share one pending timeout on
	 * purpose: only the last one scheduled survives, so two would cancel each other.
	 */
	private registerMistake(move: ChessMove): void {
		this.commit(move);
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
