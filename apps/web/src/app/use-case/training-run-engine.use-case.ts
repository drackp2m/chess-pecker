import { Injectable, inject } from '@angular/core';
import type { CalibrationRoundOutcome } from '@chesspecker/api-definitions';

import { PuzzleRow } from '@app/repository/definition/puzzle-schema.interface';
import {
	CalibrationRoundRow,
	CycleItemRow,
} from '@app/repository/definition/training-schema.interface';
import { LocalCalibrationUseCase } from '@app/use-case/local-calibration.use-case';
import { LocalCycleUseCase } from '@app/use-case/local-cycle.use-case';
import { LocalKeyUseCase } from '@app/use-case/sync/local-key.use-case';

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
	private readonly keys = inject(LocalKeyUseCase);

	async listRounds(trainingUuid: string): Promise<readonly CalibrationRoundRow[]> {
		return this.calibration.listRounds(await this.training(trainingUuid));
	}

	async createRound(trainingUuid: string): Promise<RunCalibrationRound> {
		return this.calibration.createRound(await this.training(trainingUuid));
	}

	async listRoundPuzzles(roundUuid: string): Promise<RunRoundPuzzles> {
		return this.calibration.listRoundPuzzles(await this.round(roundUuid));
	}

	async submitCalibrationAttempt(roundUuid: string): Promise<CalibrationRoundOutcome> {
		return this.calibration.closeIfComplete(await this.round(roundUuid));
	}

	async nextCycleSlot(trainingUuid: string): Promise<RunCycleSlot | null> {
		const slot = await this.cycles.nextSlot(await this.training(trainingUuid));

		return undefined === slot
			? null
			: { cycleUuid: slot.cycle.uuid, item: slot.item, puzzle: slot.puzzle };
	}

	async submitCycleAttempt(trainingUuid: string, item: CycleItemRow): Promise<boolean> {
		return this.cycles.closeIfComplete(
			await this.training(trainingUuid),
			await this.keys.current('cycle', item.cycleUuid),
		);
	}

	private training(uuid: string): Promise<string> {
		return this.keys.current('training', uuid);
	}

	private round(uuid: string): Promise<string> {
		return this.keys.current('calibrationRound', uuid);
	}
}
