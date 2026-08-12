import { DestroyRef, Injectable, effect, inject } from '@angular/core';

import { PuzzleClosure } from '@app/definition/puzzle.type';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { isUntouchedRecord } from '@app/page/puzzle/store/puzzle/record';
import {
	TrainingAttemptRecord,
	TrainingRunSlot,
} from '@app/page/training/store/training-run-state';
import { TrainingRunStore } from '@app/page/training/store/training-run.store';
import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { TrainingStore } from '@app/store/training.store';
import {
	AttemptDraft,
	AttemptDraftUseCase,
	AttemptIdentity,
} from '@app/use-case/attempt-draft.use-case';
import { PuzzleMapper } from '@app/util/puzzle-mapper';
import { SolveTimer } from '@app/util/solve-timer';

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
	private stored: AttemptRow | undefined;

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

	resume(): void {
		if (undefined !== this.slot && this.gradedUuid !== this.slot.puzzle.uuid) {
			this.timer.resume();
			this.board.resumeClock();
		}
	}

	pause(): void {
		this.timer.pause();
		this.board.pauseClock();

		void this.flush();
	}

	private discard(): void {
		this.slot = undefined;
		this.gradedUuid = undefined;
		this.draft = undefined;
		this.stored = undefined;
		this.timer.pause();
		this.run.reset();
	}

	/**
	 * Both the slot and the board are set in the same synchronous block, so the grading
	 * effect can never pair a fresh exercise with the verdict of the previous one.
	 */
	private syncBoard(slot: TrainingRunSlot | null): void {
		if (null === slot || this.slot?.puzzle.uuid === slot.puzzle.uuid) {
			return;
		}

		this.slot = slot;
		this.draft = undefined;
		this.stored = undefined;
		this.board.setPuzzles([PuzzleMapper.toPuzzle(slot.puzzle)]);
		this.timer.start();

		void this.openDraft(slot, this.identify(slot));
	}

	/**
	 * An exercise is reopened on the draft row it left behind, not from zero: without
	 * this the row would be written and then immediately overwritten with a fresh clock,
	 * which is the whole point of persisting it. A row that was closed is left alone —
	 * its verdict says nothing about that, since a missed exercise goes on being solved.
	 */
	private async openDraft(
		slot: TrainingRunSlot,
		identity: AttemptIdentity | undefined,
	): Promise<void> {
		if (undefined === identity) {
			return;
		}

		const stored = await this.drafts.find(identity).catch(() => undefined);

		if (this.slot !== slot || (undefined !== stored && 'open' !== stored.closure)) {
			return;
		}

		if (undefined !== stored) {
			this.timer.restore(stored.durationMs, stored.createdAt);
		}

		this.stored = stored;
		this.draft = {
			uuid: stored?.uuid ?? crypto.randomUUID(),
			createdAt: stored?.createdAt ?? this.timer.snapshot().createdAt,
			identity,
		};

		await this.flush();
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
			puzzleUuid: slot.puzzle.uuid,
			lichessId: slot.puzzle.lichessId,
			...(undefined === roundUuid ? {} : { roundUuid }),
			...(null === slot.cycleItemUuid ? {} : { cycleItemUuid: slot.cycleItemUuid }),
		};
	}

	private representsDraft(): boolean {
		if (undefined === this.stored) {
			return true;
		}

		const written = { record: this.board.record(), explorations: this.board.explorations() };

		return 'open' !== this.board.closure() || !isUntouchedRecord(written);
	}

	/**
	 * Everything the row is composed from is read synchronously, so a flush in flight
	 * while the next exercise opens still writes the clock of the one it belongs to.
	 * A failed write is swallowed on purpose: losing the draft must not stop the solve.
	 *
	 * The verdict goes in as soon as the board settles it, which is not the end of the
	 * exercise any more: what says the row is finished is its closure.
	 */
	private flush(): Promise<void> {
		const draft = this.draft;

		if (undefined === draft || !this.representsDraft()) {
			return Promise.resolve();
		}

		const { durationMs, startedAt, updatedAt } = this.timer.snapshot();
		const result = this.board.result();

		return this.drafts
			.save(draft, {
				durationMs,
				updatedAt,
				record: this.board.record(),
				explorations: this.board.explorations(),
				orientation: this.board.orientation(),
				closure: this.board.closure(),
				hintUsed: this.board.hintUsed(),
				mistakeCount: this.board.mistakeCount(),
				...(undefined === startedAt ? {} : { startedAt }),
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

		if ('open' === closure || undefined === slot || undefined === result) {
			return;
		}

		if (this.gradedUuid === slot.puzzle.uuid) {
			return;
		}

		this.gradedUuid = slot.puzzle.uuid;

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

		if ((await this.run.grade(attempt, timing)) && undefined !== draft) {
			await this.drafts.markSynced(draft);
		}
	}
}
