import { Injectable, inject } from '@angular/core';
import type { CalibrationRoundOutcome } from '@chesspecker/api-definitions';

import { PuzzleRow } from '@app/repository/definition/puzzle-schema.interface';
import {
	CalibrationRoundRow,
	CycleItemRow,
} from '@app/repository/definition/training-schema.interface';
import { LocalCalibrationUseCase } from '@app/use-case/local-calibration.use-case';
import { LocalCycleUseCase } from '@app/use-case/local-cycle.use-case';

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
	private readonly calibration = inject(LocalCalibrationUseCase);
	private readonly cycles = inject(LocalCycleUseCase);

	async listRounds(trainingUuid: string): Promise<readonly CalibrationRoundRow[]> {
		return this.calibration.listRounds(trainingUuid);
	}

	async createRound(trainingUuid: string): Promise<RunCalibrationRound> {
		return this.calibration.createRound(trainingUuid);
	}

	async listRoundPuzzles(roundUuid: string): Promise<RunRoundPuzzles> {
		return this.calibration.listRoundPuzzles(roundUuid);
	}

	async submitCalibrationAttempt(roundUuid: string): Promise<CalibrationRoundOutcome> {
		return this.calibration.closeIfComplete(roundUuid);
	}

	async nextCycleSlot(trainingUuid: string): Promise<RunCycleSlot | null> {
		const slot = await this.cycles.nextSlot(trainingUuid);

		return undefined === slot
			? null
			: { cycleUuid: slot.cycle.uuid, item: slot.item, puzzle: slot.puzzle };
	}

	async submitCycleAttempt(trainingUuid: string, item: CycleItemRow): Promise<boolean> {
		return this.cycles.closeIfComplete(trainingUuid, item.cycleUuid);
	}
}
