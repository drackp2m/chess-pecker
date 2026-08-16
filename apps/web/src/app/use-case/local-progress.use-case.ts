import { Injectable, inject } from '@angular/core';
import type {
	CalibrationRoundProgress,
	CycleProgress,
	TrainingProgress,
} from '@chesspecker/api-definitions';

import { TrainingPolicy } from '@app/definition/training-policy.constant';
import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import {
	CalibrationRoundRow,
	TrainingCycleRow,
} from '@app/repository/definition/training-schema.interface';
import { TrainingLocalRepository } from '@app/repository/training-local.repository';
import { LocalCalibrationUseCase } from '@app/use-case/local-calibration.use-case';
import { LocalCycleUseCase } from '@app/use-case/local-cycle.use-case';
import { LocalTrainingUseCase } from '@app/use-case/local-training.use-case';

@Injectable({
	providedIn: 'root',
})
export class LocalProgressUseCase {
	private readonly repository = inject(TrainingLocalRepository);
	private readonly trainings = inject(LocalTrainingUseCase);
	private readonly calibration = inject(LocalCalibrationUseCase);
	private readonly cycles = inject(LocalCycleUseCase);

	async build(trainingUuid: string): Promise<TrainingProgress> {
		const attempts = await this.repository.findAllByIndex('attempt', 'trainingUuid', trainingUuid);
		const closed = attempts.filter((attempt) => 'open' !== attempt.closure);

		const setSize = (await this.cycles.listSet(trainingUuid)).length;
		const goal = await this.trainings.currentGoal(trainingUuid);
		const cycles = await this.buildCycles(trainingUuid, closed);

		return {
			calibration: await this.buildCalibration(trainingUuid, closed),
			setSize,
			goal:
				undefined === goal
					? null
					: { puzzlesPerDay: goal.puzzlesPerDay ?? null, endDate: goal.endDate ?? null },
			estimatedFirstCycleDays:
				undefined === goal?.puzzlesPerDay || 0 === setSize
					? null
					: Math.ceil(setSize / goal.puzzlesPerDay),
			cycles,
			suggestFinish: shouldSuggestFinish(cycles),
		};
	}

	private async buildCalibration(
		trainingUuid: string,
		attempts: readonly AttemptRow[],
	): Promise<TrainingProgress['calibration']> {
		const rounds = await this.calibration.listRounds(trainingUuid);
		const progress: CalibrationRoundProgress[] = [];

		for (const round of rounds) {
			progress.push(await this.buildRound(round, attempts));
		}

		const accepted = progress.find((round) => 'accept' === round.outcome);

		return {
			rating: accepted?.rating ?? null,
			averageDurationMs: accepted?.averageDurationMs ?? null,
			rounds: progress,
		};
	}

	private async buildRound(
		round: CalibrationRoundRow,
		attempts: readonly AttemptRow[],
	): Promise<CalibrationRoundProgress> {
		const dealt = await this.repository.findAllByIndex(
			'calibrationPuzzle',
			'roundUuid',
			round.uuid,
		);
		const played = attempts.filter((attempt) => round.uuid === attempt.roundUuid);

		return {
			uuid: round.uuid,
			index: round.index,
			kind: round.kind,
			rating: round.rating,
			outcome: round.outcome,
			attempted: played.length,
			total: dealt.length,
			solved: countSolved(played),
			averageDurationMs: averageDuration(played),
		};
	}

	private async buildCycles(
		trainingUuid: string,
		attempts: readonly AttemptRow[],
	): Promise<CycleProgress[]> {
		const cycles = await this.cycles.listCycles(trainingUuid);
		const progress: CycleProgress[] = [];

		let firstCycleDurationMs: number | null = null;

		for (const cycle of cycles) {
			const items = await this.cycles.listItems(cycle.uuid);
			const played = attempts.filter((attempt) =>
				items.some((item) => item.uuid === attempt.cycleItemUuid),
			);

			if (1 === cycle.index) {
				firstCycleDurationMs = sumDuration(played);
			}

			progress.push(toCycleProgress(cycle, played, items.length, firstCycleDurationMs));
		}

		return progress;
	}
}

const toCycleProgress = (
	cycle: TrainingCycleRow,
	attempts: readonly AttemptRow[],
	total: number,
	firstCycleDurationMs: number | null,
): CycleProgress => {
	const totalDurationMs = sumDuration(attempts);
	const solved = countSolved(attempts);

	return {
		uuid: cycle.uuid,
		index: cycle.index,
		status: cycle.status,
		startedAt: cycle.createdAt.toISOString(),
		attempted: attempts.length,
		total,
		solved,
		accuracy: 0 === attempts.length ? 0 : solved / attempts.length,
		totalDurationMs,
		averageDurationMs: averageDuration(attempts),
		targetDurationMs: resolveTarget(cycle.index, firstCycleDurationMs),
		lastAttemptAt: lastAttemptAt(attempts),
	};
};

const resolveTarget = (index: number, firstCycleDurationMs: number | null): number | null => {
	if (1 === index || null === firstCycleDurationMs || 0 === firstCycleDurationMs) {
		return null;
	}

	const factors = TrainingPolicy.cycleTargetFactors;
	const factor = factors[Math.min(index - 2, factors.length - 1)];

	return undefined === factor ? null : Math.round(firstCycleDurationMs * factor);
};

const shouldSuggestFinish = (cycles: readonly CycleProgress[]): boolean => {
	const finished = cycles.filter((cycle) => cycle.attempted === cycle.total && 0 < cycle.total);

	if (finished.length < TrainingPolicy.minCycles) {
		return false;
	}

	const last = finished.at(-1);
	const previous = finished.at(-2);

	if (undefined === last || undefined === previous || 0 === previous.totalDurationMs) {
		return false;
	}

	const improvement = (previous.totalDurationMs - last.totalDurationMs) / previous.totalDurationMs;

	return improvement < TrainingPolicy.plateauImprovement;
};

const countSolved = (attempts: readonly AttemptRow[]): number =>
	attempts.filter((attempt) => true === attempt.solved).length;

const sumDuration = (attempts: readonly AttemptRow[]): number =>
	attempts.reduce((total, attempt) => total + attempt.durationMs, 0);

const averageDuration = (attempts: readonly AttemptRow[]): number =>
	0 === attempts.length ? 0 : Math.round(sumDuration(attempts) / attempts.length);

const lastAttemptAt = (attempts: readonly AttemptRow[]): string | null => {
	const latest = attempts.reduce<Date | null>(
		(kept, attempt) => (null === kept || attempt.updatedAt > kept ? attempt.updatedAt : kept),
		null,
	);

	return null === latest ? null : latest.toISOString();
};
