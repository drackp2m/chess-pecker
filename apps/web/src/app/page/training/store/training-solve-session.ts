import { DestroyRef, Injectable, effect, inject } from '@angular/core';
import { patchState } from '@ngrx/signals';

import { PuzzleClosure, PuzzleResult } from '@app/definition/puzzle.type';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { PuzzleRestore } from '@app/page/puzzle/store/puzzle/session';
import {
	TrainingAttemptRecord,
	TrainingRunSlot,
} from '@app/page/training/store/training-run-state';
import { TrainingRunStore } from '@app/page/training/store/training-run.store';
import { AttemptDraftRow } from '@app/repository/definition/attempt-draft-schema.interface';
import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { TrainingStore } from '@app/store/training.store';
import {
	AttemptDraft,
	AttemptDraftUseCase,
	AttemptIdentity,
} from '@app/use-case/attempt-draft.use-case';
import { SolvedAttempt } from '@app/use-case/training-history.use-case';
import { PuzzleMapper } from '@app/util/puzzle-mapper';
import { SolveTimer, SolveTiming } from '@app/util/solve-timer';

interface SuspendedBoard {
	readonly restore: PuzzleRestore;
	readonly hintUnlocked: boolean;
}

@Injectable()
export class TrainingSolveSession {
	private readonly run = inject(TrainingRunStore);
	private readonly board = inject(PuzzleStore);
	private readonly training = inject(TrainingStore);
	private readonly drafts = inject(AttemptDraftUseCase);
	private readonly timer = new SolveTimer(() => {
		void this.flush();
	});

	private slot: TrainingRunSlot | undefined;
	private gradedUuid: string | undefined;
	private draft: AttemptDraft | undefined;
	private isReviewing = false;
	private suspended: SuspendedBoard | undefined;

	constructor() {
		effect(() => {
			this.syncBoard(this.run.current());
		});

		effect(() => {
			this.submitIfClosed(this.board.closure());
		});

		effect(() => {
			if (0 < this.board.line().length) {
				void this.flush();
			}
		});

		inject(DestroyRef).onDestroy(() => {
			this.pause();
		});
	}

	/**
	 * The board outlives the page it is drawn on, so an exercise picked up again is the
	 * one that was left — cursor, line and all. What it must not be is the beat it was
	 * left mid-way through: the board is redrawn from scratch here, and a rewind still
	 * standing in it would be run again as if it had just been asked for. It is replayed
	 * from the line instead, which is what the position on screen was arrived at by.
	 */
	async open(): Promise<void> {
		if (this.isReviewing) {
			this.leaveSolved();

			return;
		}

		if (undefined !== this.slot && !this.run.isDone()) {
			this.resume();
			this.board.replayLastMove();

			return;
		}

		this.discard();

		if (null === this.training.active()) {
			await this.training.load();
		}

		const active = this.training.active();

		if (null !== active) {
			await this.run.begin(active);
		}
	}

	showSolved(entry: SolvedAttempt): void {
		if (!this.isReviewing) {
			this.suspended = this.captureBoard();
			this.pause();
			this.isReviewing = true;
		}

		this.board.setPuzzles([entry.puzzle]);
		this.board.restoreFrom(this.toRestore(entry.row, entry.row.closure));
	}

	leaveSolved(): void {
		const slot = this.slot;
		const suspended = this.suspended;

		if (!this.isReviewing) {
			return;
		}

		this.isReviewing = false;
		this.suspended = undefined;

		if (undefined === slot) {
			return;
		}

		this.board.setPuzzles([PuzzleMapper.toPuzzle(slot.puzzle)]);

		if (undefined !== suspended) {
			this.board.restoreFrom(suspended.restore);
			patchState(this.board, { hintUnlocked: suspended.hintUnlocked });
		}

		this.resume();
		this.board.replayLastMove();
	}

	resume(): void {
		if (this.isReviewing) {
			return;
		}

		if (undefined !== this.slot && this.gradedUuid !== PuzzleMapper.toKey(this.slot.puzzle)) {
			this.timer.resume();
			this.board.resumeClock();
		}
	}

	pause(): void {
		this.timer.pause();
		this.board.pauseClock();

		void this.flush();
	}

	private captureBoard(): SuspendedBoard {
		return {
			hintUnlocked: this.board.hintUnlocked(),
			restore: {
				record: [...this.board.record()],
				explorations: this.board
					.explorations()
					.map((run) => ({ at: run.at, events: [...run.events] })),
				closure: this.board.closure(),
				hintUsed: this.board.hintUsed(),
				mistakeCount: this.board.mistakeCount(),
				result: this.board.result(),
			},
		};
	}

	private discard(): void {
		this.slot = undefined;
		this.gradedUuid = undefined;
		this.draft = undefined;
		this.timer.pause();
		this.run.reset();
	}

	/**
	 * Both the slot and the board are set in the same synchronous block, so the grading
	 * effect can never pair a fresh exercise with the verdict of the previous one.
	 */
	private syncBoard(slot: TrainingRunSlot | null): void {
		if (null === slot || this.isReviewing) {
			return;
		}

		const current = this.slot;

		if (
			undefined !== current &&
			PuzzleMapper.toKey(current.puzzle) === PuzzleMapper.toKey(slot.puzzle)
		) {
			return;
		}

		this.slot = slot;
		this.draft = undefined;
		this.board.setPuzzles([PuzzleMapper.toPuzzle(slot.puzzle)]);
		this.timer.start();

		void this.openDraft(slot, this.identify(slot));
	}

	/**
	 * An exercise is reopened on the row it left behind, not from zero: the clock is picked
	 * up where it stopped and the board is folded back out of the record, so what comes back
	 * is the exercise as it was left rather than a fresh one about to overwrite it.
	 *
	 * The board is restored before anything is written, which is what makes the draft safe
	 * to flush again — a reload that touches nothing writes back what it read.
	 */
	private async openDraft(
		slot: TrainingRunSlot,
		identity: AttemptIdentity | undefined,
	): Promise<void> {
		if (undefined === identity) {
			return;
		}

		const stored = await this.drafts.find(identity).catch(() => undefined);

		if (this.slot !== slot) {
			return;
		}

		if (undefined === stored && (await this.openClosed(slot, identity))) {
			return;
		}

		if (undefined !== stored) {
			this.timer.restore(stored.durationMs, stored.createdAt);
			this.board.restoreFrom(this.toRestore(stored, 'open'));
		}

		this.draft = {
			uuid: stored?.uuid ?? crypto.randomUUID(),
			createdAt: stored?.createdAt ?? this.timer.snapshot().createdAt,
			identity,
			...(null === slot.position ? {} : { position: slot.position }),
		};

		await this.flush();
	}

	/**
	 * Un ejercicio ya cerrado se vuelve a poner en el tablero —está ahí para mirarlo— pero
	 * es definitivo: no se le abre borrador y no se le escribe nada más.
	 */
	private async openClosed(slot: TrainingRunSlot, identity: AttemptIdentity): Promise<boolean> {
		const closed = await this.drafts.findClosed(identity).catch(() => undefined);

		if (this.slot !== slot || undefined === closed) {
			return false;
		}

		this.timer.restore(closed.durationMs, closed.createdAt);
		this.board.restoreFrom(this.toRestore(closed, closed.closure));

		return true;
	}

	/** The row as the board reads it, which is the record plus the verdict it was left on. */
	private toRestore(row: AttemptDraftRow | AttemptRow, closure: PuzzleClosure): PuzzleRestore {
		const solved: PuzzleResult = true === row.solved ? 'solved' : 'failed';

		return {
			record: row.record,
			explorations: row.explorations,
			closure,
			hintUsed: row.hintUsed,
			mistakeCount: row.mistakeCount,
			result: undefined === row.solved ? undefined : solved,
		};
	}

	private identify(slot: TrainingRunSlot): AttemptIdentity | undefined {
		const trainingUuid = this.run.trainingUuid();
		const kind = this.run.mode();

		if (null === trainingUuid || null === kind) {
			return undefined;
		}

		const roundUuid = this.run.round()?.uuid;

		return {
			trainingUuid,
			kind,
			puzzleUuid: PuzzleMapper.toKey(slot.puzzle),
			lichessId: slot.puzzle.lichessId,
			...(undefined === roundUuid ? {} : { roundUuid }),
			...(null === slot.cycleItem ? {} : { cycleItemUuid: slot.cycleItem.uuid }),
		};
	}

	/**
	 * Everything the row is composed from is read synchronously, so a flush in flight
	 * while the next exercise opens still writes the clock of the one it belongs to.
	 * A failed write is swallowed on purpose: losing the draft must not stop the solve.
	 *
	 * The verdict goes in as soon as the board settles it, which is not the end of the
	 * exercise any more: what says the row is finished is its closure.
	 *
	 * Nothing guards what it writes any more: the board it reads is the one the stored row
	 * was folded back onto, so a reload that touches nothing writes the very record it
	 * came in with.
	 */
	private flush(): Promise<void> {
		const draft = this.draft;

		if (this.isReviewing || undefined === draft) {
			return Promise.resolve();
		}

		const { durationMs, updatedAt } = this.timer.snapshot();
		const result = this.board.result();

		return this.drafts
			.save(draft, {
				durationMs,
				updatedAt,
				record: this.board.record(),
				explorations: this.board.explorations(),
				hintUsed: this.board.hintUsed(),
				mistakeCount: this.board.mistakeCount(),
				...(undefined === result ? {} : { solved: 'solved' === result }),
			})
			.catch(() => undefined);
	}

	/**
	 * Submits the attempt when the exercise closes, which is once the solution is out —
	 * found or given up on — and not when the verdict was settled: the board seals that
	 * on the first try, but the clock runs for as long as the exercise is still being
	 * worked on. The closure is settled once too, so this submits exactly once.
	 */
	private submitIfClosed(closure: PuzzleClosure): void {
		const slot = this.slot;
		const result = this.board.result();

		if ('open' === closure || this.isReviewing || undefined === slot || undefined === result) {
			return;
		}

		if (this.gradedUuid === PuzzleMapper.toKey(slot.puzzle)) {
			return;
		}

		this.gradedUuid = PuzzleMapper.toKey(slot.puzzle);

		void this.submit(closure, 'solved' === result);
	}

	/**
	 * Todo lo que hay que leer del tablero se lee de una vez, antes del primer `await`:
	 * para cuando el API conteste, la partida en pantalla puede ser ya la siguiente.
	 *
	 * El sello de subido va después del último volcado —que si no lo pisaría— y sólo si
	 * el API se quedó con el intento. Lo que no lleve sello es lo único que se perdería
	 * al vaciar el dispositivo, y es lo que mira el cierre de sesión.
	 */
	private async submit(closure: TrainingAttemptRecord['closure'], solved: boolean): Promise<void> {
		const draft = this.draft;
		const timing = this.timer.stop();
		const attempt: TrainingAttemptRecord = {
			solved,
			closure,
			hintUsed: this.board.hintUsed(),
			mistakeCount: this.board.mistakeCount(),
			record: [...this.board.record()],
			explorations: this.board
				.explorations()
				.map((run) => ({ at: run.at, events: [...run.events] })),
		};

		const flushed = this.flush();

		this.draft = undefined;

		await flushed;

		if (undefined !== draft) {
			await this.seal(draft, attempt, timing);
		}

		if ((await this.run.grade(attempt, timing)) && undefined !== draft) {
			await this.drafts.markSynced(draft);
		}
	}

	/**
	 * El borrador se convierte en intento en cuanto el ejercicio se cierra: de aquí en
	 * adelante la fila es la que sube, y ya no la toca nadie más.
	 */
	private async seal(
		draft: AttemptDraft,
		attempt: TrainingAttemptRecord,
		timing: SolveTiming,
	): Promise<void> {
		await this.drafts
			.seal(draft, {
				durationMs: timing.durationMs,
				updatedAt: new Date(timing.updatedAt),
				record: attempt.record,
				explorations: attempt.explorations,
				hintUsed: attempt.hintUsed,
				mistakeCount: attempt.mistakeCount,
				solved: attempt.solved,
				closure: attempt.closure,
			})
			.catch(() => undefined);
	}
}
