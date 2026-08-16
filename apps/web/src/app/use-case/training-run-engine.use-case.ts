import { HttpStatusCode } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { CalibrationRoundOutcome, PuzzleAttemptRecord } from '@chesspecker/api-definitions';

import { PuzzleRow } from '@app/repository/definition/puzzle-schema.interface';
import {
	CalibrationRoundRow,
	CycleItemRow,
} from '@app/repository/definition/training-schema.interface';
import { TrainingRunRepository } from '@app/repository/training-run.repository';
import { SessionStore } from '@app/store/session.store';
import { LocalCalibrationUseCase } from '@app/use-case/local-calibration.use-case';
import { LocalCycleUseCase } from '@app/use-case/local-cycle.use-case';
import { PuzzleCacheUseCase } from '@app/use-case/puzzle-cache.use-case';
import { TrainingMirrorUseCase } from '@app/use-case/training-mirror.use-case';
import { HttpError } from '@app/util/http-error';
import { PuzzleMapper } from '@app/util/puzzle-mapper';
import { SolveTiming } from '@app/util/solve-timer';

export type RunAttemptRecord = Omit<PuzzleAttemptRecord, 'durationMs'> & SolveTiming;

export interface RunCalibrationRound {
	readonly round: CalibrationRoundRow;
	readonly puzzles: readonly PuzzleRow[];
}

export interface RunRoundPuzzles {
	readonly total: number;
	readonly attempted: number;
	readonly puzzles: readonly PuzzleRow[];
}

export interface RunCycleSlot {
	readonly cycleUuid: string;
	readonly item: CycleItemRow;
	readonly puzzle: PuzzleRow;
}

@Injectable({
	providedIn: 'root',
})
export class TrainingRunEngineUseCase {
	private readonly session = inject(SessionStore);
	private readonly remote = inject(TrainingRunRepository);
	private readonly mirror = inject(TrainingMirrorUseCase);
	private readonly calibration = inject(LocalCalibrationUseCase);
	private readonly cycles = inject(LocalCycleUseCase);
	private readonly puzzleCache = inject(PuzzleCacheUseCase);

	isRemote(): boolean {
		return this.session.isAuthenticated();
	}

	async listRounds(trainingUuid: string): Promise<readonly CalibrationRoundRow[]> {
		if (this.isRemote()) {
			await this.mirror.rounds(trainingUuid, await this.remote.listRounds(trainingUuid));
		}

		return this.calibration.listRounds(trainingUuid);
	}

	async createRound(trainingUuid: string): Promise<RunCalibrationRound> {
		if (!this.isRemote()) {
			return this.calibration.createRound(trainingUuid);
		}

		const { round, puzzles } = await this.remote.createRound(trainingUuid);

		await this.puzzleCache.save(puzzles);
		await this.mirror.roundPuzzles(round.uuid, puzzles, 0);

		return {
			round: await this.mirror.round(trainingUuid, round),
			puzzles: puzzles.map((puzzle) => PuzzleMapper.toRow(puzzle)),
		};
	}

	async listRoundPuzzles(trainingUuid: string, roundUuid: string): Promise<RunRoundPuzzles> {
		if (!this.isRemote()) {
			return this.calibration.listRoundPuzzles(roundUuid);
		}

		const dealt = await this.remote.listRoundPuzzles(trainingUuid, roundUuid);

		await this.puzzleCache.save(dealt.puzzles);
		await this.mirror.roundPuzzles(roundUuid, dealt.puzzles, dealt.attempted);

		return {
			total: dealt.total,
			attempted: dealt.attempted,
			puzzles: dealt.puzzles.map((puzzle) => PuzzleMapper.toRow(puzzle)),
		};
	}

	async submitCalibrationAttempt(
		trainingUuid: string,
		round: CalibrationRoundRow,
		puzzle: PuzzleRow,
		attempt: RunAttemptRecord,
	): Promise<CalibrationRoundOutcome> {
		if (!this.isRemote()) {
			return this.calibration.closeIfComplete(round.uuid);
		}

		const puzzleUuid = puzzle.uuid;

		if (undefined === puzzleUuid) {
			throw new Error('The exercise is not in the server catalog');
		}

		const { outcome } = await this.remote.submitCalibrationAttempt(trainingUuid, {
			roundUuid: round.uuid,
			puzzleUuid,
			...attempt,
		});

		if ('pending' !== outcome) {
			await this.mirror.round(trainingUuid, {
				uuid: round.uuid,
				index: round.index,
				kind: round.kind,
				rating: round.rating,
				outcome,
			});
		}

		return outcome;
	}

	async nextCycleSlot(trainingUuid: string): Promise<RunCycleSlot | null> {
		if (!this.isRemote()) {
			const slot = await this.cycles.nextSlot(trainingUuid);

			return undefined === slot
				? null
				: { cycleUuid: slot.cycle.uuid, item: slot.item, puzzle: slot.puzzle };
		}

		const cycleUuid = await this.resolveRunningCycle(trainingUuid);
		const item = await this.fetchNextItem(trainingUuid);

		if (null === item || null === cycleUuid) {
			return null;
		}

		await this.puzzleCache.save([item.trainingPuzzle.puzzle]);
		await this.mirror.cycleItem(cycleUuid, item);

		const stored = await this.cycles.findItem(item.uuid);

		return undefined === stored
			? null
			: { cycleUuid, item: stored, puzzle: PuzzleMapper.toRow(item.trainingPuzzle.puzzle) };
	}

	async submitCycleAttempt(
		trainingUuid: string,
		item: CycleItemRow,
		attempt: RunAttemptRecord,
	): Promise<boolean> {
		if (!this.isRemote()) {
			return this.cycles.closeIfComplete(trainingUuid, item.cycleUuid);
		}

		const { cycleFinished } = await this.remote.submitCycleAttempt(trainingUuid, {
			cycleItemUuid: item.uuid,
			...attempt,
		});

		if (cycleFinished) {
			await this.mirror.cycles(trainingUuid, await this.remote.listCycles(trainingUuid));
		}

		return cycleFinished;
	}

	private async resolveRunningCycle(trainingUuid: string): Promise<string | null> {
		const known = await this.cycles.findRunningCycle(trainingUuid);

		if (undefined !== known) {
			return known.uuid;
		}

		const cycles = await this.remote.listCycles(trainingUuid);

		await this.mirror.cycles(trainingUuid, cycles);

		return cycles.find((cycle) => 'running' === cycle.status)?.uuid ?? null;
	}

	private async fetchNextItem(
		trainingUuid: string,
	): Promise<Awaited<ReturnType<TrainingRunRepository['getNextItem']>> | null> {
		try {
			return await this.remote.getNextItem(trainingUuid);
		} catch (error) {
			if (!HttpError.hasStatus(error, HttpStatusCode.NotFound)) {
				throw error;
			}

			return null;
		}
	}
}
