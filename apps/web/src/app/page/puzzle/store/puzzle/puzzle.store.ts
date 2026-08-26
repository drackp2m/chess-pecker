import { Injectable, inject } from '@angular/core';
import { patchState, signalStore, withState } from '@ngrx/signals';

import { BoardPresenter } from '@app/definition/board-presenter.interface';
import { ChessMove, PromotionPieceType, Square } from '@app/definition/chess.type';
import {
	Puzzle,
	PuzzleClosure,
	PuzzleOutcome,
	PuzzleRecord,
	settleClosure,
	settleResult,
} from '@app/definition/puzzle.type';
import { withPuzzleComputed } from '@app/page/puzzle/store/puzzle/computed';
import { withPuzzleGating } from '@app/page/puzzle/store/puzzle/gating';
import { withPuzzlePlayback } from '@app/page/puzzle/store/puzzle/playback';
import { PlaybackHooks, withPuzzlePlayer } from '@app/page/puzzle/store/puzzle/player';
import {
	RESTART_PROGRAM,
	replyProgram,
	resumeProgram,
	revealProgram,
} from '@app/page/puzzle/store/puzzle/program';
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
	restartPatch,
	restoreFreePlayPatch,
	restorePatch,
	restoredTransition,
	revealCursor,
	revealPatch,
	revealedLine,
} from '@app/page/puzzle/store/puzzle/session';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library/puzzle-library.store';
import { nextTransition } from '@app/util/chess/board-transition';
import { ChessNotation } from '@app/util/chess/chess-notation';

@Injectable()
export class PuzzleStore
	extends signalStore(
		{ protectedState: false },
		withState(buildPuzzleState),
		withPuzzleComputed(),
		withPuzzleGating(),
		withPuzzlePlayer(),
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
	 * Back to the board the exercise opened on, leaving the line whole. Inside an
	 * free-play run the sandbox is thrown away and the main line comes back instead.
	 */
	restart(): void {
		const puzzle = this.puzzle();

		if (undefined === puzzle) {
			// Written before anything moves, so it lands in the record the exercise already had.
			this.open(this.verdict(), append(this.recordState(), { kind: 'restart' }));

			return;
		}

		// The sandbox stays open, so the restart is written inside the free-play run.
		this.append({ kind: 'restart' });
		patchState(this, restartPatch(this.closure(), undefined !== this.freePlayScratch()));
		this.run(RESTART_PROGRAM, this.playbackHooks());
	}

	/**
	 * Replays the last move of the visible line for a board being come back to. It may not
	 * cut short a playback in flight or a pending take-back: both answer what the player did.
	 */
	replayLastMove(): void {
		const cursor = this.cursor();
		const isReplayable =
			undefined !== this.line()[cursor - 1] && undefined !== this.positions()[cursor - 1];

		if (!isReplayable || this.isReplaying() || undefined !== this.mistake()) {
			patchState(this, { transition: undefined });

			return;
		}

		this.run(resumeProgram(cursor), this.playbackHooks());
	}

	/**
	 * Gives up and plays out the rest of the solution. It ends the exercise but not the
	 * verdict, settled on the first try; asked for again it replays the whole line.
	 */
	revealSolution(): void {
		if (!this.canRevealSolution()) {
			return;
		}

		this.stop();

		const wasOpen = this.isOpen();
		const cursor = revealCursor(this.lineState(), wasOpen ? this.deviation() : 0);
		// Judged against the cursor as it stands, which is what it describes: the rewind moves it.
		const rewind = { cursor: this.cursor(), transition: this.transition() };

		// Written before the record closes, or the log would end on a board the line has left.
		if (wasOpen) {
			this.seek(cursor);
		}

		patchState(this, revealPatch({ ...rewind, closure: this.closure() }, cursor));

		// Read off the board the rewind left standing, and written whole: a programme can only
		// walk a stretch of line that already exists.
		const answer = revealedLine(this.positions(), this.puzzle()?.moves ?? [], cursor);

		patchState(this, { revealed: answer, rewound: answer.moves.length });
		this.run(revealProgram(cursor + answer.moves.length), this.playbackHooks());
	}

	/**
	 * Puts a saved exercise back exactly as it was left: nothing is played, the line is
	 * folded out of the record in one go and only the move it stands on travels.
	 */
	restoreFrom(stored: PuzzleRestore): void {
		const puzzle = this.puzzle();

		if (undefined === puzzle) {
			return;
		}

		this.stop();
		patchState(this, restorePatch(stored, this.playerColor()));

		// Read after the log is in: the line it describes is what the slide travels along.
		patchState(this, { transition: restoredTransition(this.lineState()) });
		patchState(this, { outcome: this.outcomeAt(this.cursor()) });
	}

	/**
	 * Uncovers the themes. It counts as help, so it is recorded where it was asked for, but
	 * it closes nothing and is unavailable for the first `HINT_DELAY_MS`.
	 */
	useHint(): void {
		if (!this.canUseHint()) {
			return;
		}

		this.append({ kind: 'hint' }, { hintUsed: true });
	}

	toggleFreePlay(): void {
		this.stopPlayback();

		const anchor = this.freePlay();

		if (undefined === anchor) {
			this.enterFreePlay();

			return;
		}

		// Letting go of the run restores the main line, standing where the free-play run began.
		patchState(
			this,
			restoreFreePlayPatch(
				{ cursor: this.cursor(), transition: this.transition() },
				anchor,
				undefined !== this.freePlayScratch(),
			),
		);
	}

	/**
	 * Rewinds one ply. Stepping back over the move that broke the script puts the
	 * exercise back on the rails, so a wrong move can always be tried again.
	 */
	stepBackward(): void {
		this.stopPlayback();

		const undone = this.line()[this.cursor() - 1];

		this.moveCursor(Math.max(0, this.cursor() - 1), undone, 'backward');
	}

	stepForward(): void {
		this.stopPlayback();

		const replayed = this.line()[this.cursor()];

		this.moveCursor(Math.min(this.line().length, this.cursor() + 1), replayed, 'forward');
	}

	selectSquare(square: Square): void {
		this.stopPlayback();

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

		this.stop();

		if (undefined === puzzle) {
			patchState(this, buildPuzzleState());

			return;
		}

		patchState(this, { ...openPuzzle(puzzle), ...recorded, ...verdict });
		this.armHintGate();
		this.replyScripted();
	}

	private lineState() {
		return { positions: this.positions(), line: this.line(), cursor: this.cursor() };
	}

	/**
	 * The two hooks the player cannot reach itself, since they live on the store. The seek is
	 * always the held one: everything real is written before the programme is handed over.
	 * Inside the sandbox of a closed exercise the hold is the sandbox itself, which takes it.
	 */
	private playbackHooks(): PlaybackHooks {
		return {
			seek: (to: number): void => {
				if (undefined !== this.freePlayScratch()) {
					this.seek(to);

					return;
				}

				patchState(this, { rewound: Math.max(0, this.rewound() + this.cursor() - to) });
			},

			settled: (): void => {
				this.settleOutcome();
			},
		};
	}

	/**
	 * The verdict, read off the head the board stands on. A script that ran out and a line
	 * walked to its end have to leave the exercise saying the same thing.
	 */
	private settleOutcome(): void {
		const outcome = this.outcomeAt(this.cursor());

		patchState(this, { outcome, closure: this.landedClosure(outcome) });
	}

	/**
	 * Whether the line that just landed ends the exercise. Only the main line can; free play
	 * is a sandbox that never reaches it.
	 */
	private landedClosure(outcome: PuzzleOutcome): PuzzleClosure {
		const isFound = 'solved' === outcome && undefined === this.freePlay();

		return isFound ? settleClosure(this.closure(), 'found') : this.closure();
	}

	/**
	 * Lets the opponent answer, with the head held a ply behind so a programme has somewhere
	 * to walk. A script that no longer parses ends the line, and the verdict is read on the spot.
	 */
	private replyScripted(): void {
		const cursor = this.cursor();
		const scripted = this.puzzle()?.moves[cursor];
		const move =
			undefined === scripted ? undefined : ChessNotation.parse(this.position(), scripted);

		if (undefined === move) {
			this.settleOutcome();

			return;
		}

		this.append({ kind: 'move', move }, { rewound: 1 });
		this.run(replyProgram(cursor + 1), this.playbackHooks());
	}

	/**
	 * The user did something new: it goes on the end of the log and the cursor follows.
	 * `append` holds the guard, so a closed exercise takes none of it outside its sandbox.
	 */
	private append(action: PuzzleAction, patch?: Partial<PuzzleStoreProps>): void {
		patchState(this, (state) => append(state, action), patch ?? {});
	}

	/**
	 * Moves the head over what already exists, writing only the step so the log can replay
	 * back to this board. A sealed record takes no steps, so the cursor travels beside it —
	 * unless its sandbox is open, which takes them like any other free-play run.
	 */
	private seek(cursor: number, patch?: Partial<PuzzleStoreProps>): void {
		const clamped = Math.max(0, Math.min(this.line().length, cursor));

		if ('open' !== this.closure() && undefined === this.freePlayScratch()) {
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
			freePlayRuns: this.freePlayRuns(),
			freePlayIndex: this.freePlayIndex(),
			freePlayScratch: this.freePlayScratch(),
			closure: this.closure(),
		};
	}

	/**
	 * Opens a sandbox on the end of the log. The entry event records where the main line
	 * stood and the fold works the rest out, so only the open index is held. A closed
	 * exercise records none of it: its sandbox is the scratch the entry opened instead.
	 */
	private enterFreePlay(): void {
		const opened = this.freePlayRuns().length;

		this.append({ kind: 'entry' });

		const isRecorded = opened < this.freePlayRuns().length;

		if (!isRecorded && undefined === this.freePlayScratch()) {
			return;
		}

		patchState(this, {
			...(isRecorded ? { freePlayIndex: opened } : {}),
			selected: undefined,
			pendingPromotion: undefined,
		});
	}

	/**
	 * Anything the player does abandons whatever the board was playing by itself. Only the
	 * outcome is read back: stopping the watching is not what ends the exercise.
	 */
	private stopPlayback(): void {
		this.stop();
		patchState(this, { outcome: this.outcomeAt(this.cursor()) });
	}

	/** Both steppers land here, so the verdict is read the same way either way. */
	private moveCursor(
		cursor: number,
		stepped: ChessMove | undefined,
		kind: 'backward' | 'forward',
	): void {
		const outcome = this.outcomeAt(cursor);
		// The board the move was played on: the lower of the two cursors it sits between.
		const played = this.positions()[Math.min(cursor, this.cursor())];

		this.seek(cursor, {
			selected: undefined,
			outcome,
			result: settleResult(this.result(), outcome),
			// The cursor stayed put, so what the board shows still stands and must not be cleared.
			...(undefined === stepped || undefined === played
				? {}
				: { transition: nextTransition(played, stepped, kind) }),
		});
	}

	/**
	 * Grades the player's move, then lets the opponent answer if it was right. Free play is a
	 * sandbox: nothing played there may reach `result`, and both sides are the player's to move.
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
			closure: this.landedClosure(outcome),
		});

		if ('solved' !== outcome) {
			this.replyScripted();
		}
	}

	/** Take-back and answer share one timeout on purpose: two would cancel each other. */
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
