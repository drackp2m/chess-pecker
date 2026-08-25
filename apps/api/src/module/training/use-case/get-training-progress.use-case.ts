import { Injectable } from '@nestjs/common';

import { CalibrationRoundOutcome } from '../definition/calibration-round-outcome.enum';
import { TrainingPolicy } from '../definition/training-policy';
import {
	CalibrationRoundProgress,
	CycleProgress,
	TrainingProgress,
} from '../definition/training-progress.interface';
import { PuzzleAttempt } from '../puzzle-attempt.entity';
import { PuzzleAttemptRepository } from '../puzzle-attempt.repository';
import { TrainingCalibrationPuzzleRepository } from '../training-calibration-puzzle.repository';
import { TrainingCalibrationRoundRepository } from '../training-calibration-round.repository';
import { TrainingCycleItemRepository } from '../training-cycle-item.repository';
import { TrainingCycle } from '../training-cycle.entity';
import { TrainingCycleRepository } from '../training-cycle.repository';
import { TrainingGoalRepository } from '../training-goal.repository';
import { TrainingPuzzleRepository } from '../training-puzzle.repository';
import { Training } from '../training.entity';

@Injectable()
export class GetTrainingProgressUseCase {
	constructor(
		private readonly trainingCycleRepository: TrainingCycleRepository,
		private readonly trainingCycleItemRepository: TrainingCycleItemRepository,
		private readonly trainingPuzzleRepository: TrainingPuzzleRepository,
		private readonly trainingGoalRepository: TrainingGoalRepository,
		private readonly calibrationRoundRepository: TrainingCalibrationRoundRepository,
		private readonly calibrationPuzzleRepository: TrainingCalibrationPuzzleRepository,
		private readonly puzzleAttemptRepository: PuzzleAttemptRepository,
	) {}

	/**
	 * Everything shown about a training, aggregated over `puzzle_attempt`: none of it is
	 * stored, being sums over rows that no longer change.
	 */
	async execute(training: Training): Promise<TrainingProgress> {
		const calibration = await this.resolveCalibration(training);
		const setSize = await this.trainingPuzzleRepository.countByTraining(training.uuid);
		const goal = await this.trainingGoalRepository.getCurrentByTraining(training.uuid);
		const progress = await this.resolveCycles(training);

		return {
			calibration,
			setSize,
			goal:
				undefined === goal
					? null
					: { puzzlesPerDay: goal.puzzlesPerDay ?? null, endDate: goal.endDate ?? null },
			// ToDo => the estimate ignores the two things that would personalise it: the
			// calibration average, and the goal's `endDate`, so a date-only goal estimates `null`.
			estimatedFirstCycleDays:
				undefined === goal?.puzzlesPerDay || 0 === setSize
					? null
					: Math.ceil(setSize / goal.puzzlesPerDay),
			cycles: progress,
			suggestFinish: GetTrainingProgressUseCase.shouldSuggestFinish(progress),
		};
	}

	private static toCycleProgress(
		cycle: TrainingCycle,
		attempts: PuzzleAttempt[],
		total: number,
		firstCycleDurationMs: number | null,
	): CycleProgress {
		const totalDurationMs = sumDuration(attempts);
		const solved = attempts.filter((attempt) => attempt.solved).length;

		return {
			uuid: cycle.uuid,
			index: cycle.index,
			status: cycle.status,
			startedAt: cycle.createdAt,
			attempted: attempts.length,
			total,
			solved,
			accuracy: 0 === attempts.length ? 0 : solved / attempts.length,
			totalDurationMs,
			averageDurationMs: 0 === attempts.length ? 0 : Math.round(totalDurationMs / attempts.length),
			targetDurationMs: GetTrainingProgressUseCase.resolveTarget(cycle.index, firstCycleDurationMs),
			lastAttemptAt: lastAttemptAt(attempts),
		};
	}

	/**
	 * Every pass is held to the first one's real time, which is what the method measures
	 * success against. Cycle 1 has no target: it is the bar.
	 */
	private static resolveTarget(index: number, firstCycleDurationMs: number | null): number | null {
		if (1 === index || null === firstCycleDurationMs || 0 === firstCycleDurationMs) {
			return null;
		}

		// The last factor holds from there on: cycles 5, 6 and 7 are held to cycle 4, already
		// "as fast as possible without losing accuracy".
		const factors = TrainingPolicy.cycleTargetFactors;
		const factor = factors[Math.min(index - 2, factors.length - 1)];

		if (undefined === factor) {
			return null;
		}

		return Math.round(firstCycleDurationMs * factor);
	}

	private static shouldSuggestFinish(cycles: CycleProgress[]): boolean {
		const finished = cycles.filter((cycle) => cycle.attempted === cycle.total && 0 < cycle.total);

		if (finished.length < TrainingPolicy.minCycles) {
			return false;
		}

		const last = finished.at(-1);
		const previous = finished.at(-2);

		if (undefined === last || undefined === previous || 0 === previous.totalDurationMs) {
			return false;
		}

		const improvement =
			(previous.totalDurationMs - last.totalDurationMs) / previous.totalDurationMs;

		return improvement < TrainingPolicy.plateauImprovement;
	}

	/** The ELO the calibration closed on, and what it took to get there. */
	private async resolveCalibration(training: Training): Promise<TrainingProgress['calibration']> {
		const rounds = await this.resolveCalibrationRounds(training);
		const accepted = rounds.find((round) => CalibrationRoundOutcome.Accept === round.outcome);

		return {
			rating: accepted?.rating ?? null,
			averageDurationMs: accepted?.averageDurationMs ?? null,
			rounds,
		};
	}

	/**
	 * Round by round, which is how a calibration reads: where it tried, how much landed there,
	 * and where that sent the next one.
	 */
	private async resolveCalibrationRounds(training: Training): Promise<CalibrationRoundProgress[]> {
		const rounds = await this.calibrationRoundRepository.getManyByTraining(training.uuid);
		const progress: CalibrationRoundProgress[] = [];

		for (const round of rounds) {
			const attempts = await this.puzzleAttemptRepository.getManyByCalibrationRound(round.uuid);
			const total = await this.calibrationPuzzleRepository.countByRound(round.uuid);

			progress.push({
				uuid: round.uuid,
				index: round.index,
				kind: round.kind,
				rating: round.rating,
				outcome: round.outcome,
				attempted: attempts.length,
				total,
				solved: attempts.filter((attempt) => attempt.solved).length,
				averageDurationMs:
					0 === attempts.length ? 0 : Math.round(sumDuration(attempts) / attempts.length),
			});
		}

		return progress;
	}

	/**
	 * One pass per cycle, in order: each target measures against the first cycle's real
	 * duration, so that one has to be walked before anything can be asked of the rest.
	 */
	private async resolveCycles(training: Training): Promise<CycleProgress[]> {
		const cycles = await this.trainingCycleRepository.getManyByTraining(training.uuid);

		const progress: CycleProgress[] = [];
		let firstCycleDurationMs: number | null = null;

		for (const cycle of cycles) {
			const attempts = await this.puzzleAttemptRepository.getManyByCycle(cycle.uuid);
			const total = await this.trainingCycleItemRepository.countByCycle(cycle.uuid);

			if (1 === cycle.index) {
				firstCycleDurationMs = sumDuration(attempts);
			}

			progress.push(
				GetTrainingProgressUseCase.toCycleProgress(cycle, attempts, total, firstCycleDurationMs),
			);
		}

		return progress;
	}
}

const sumDuration = (attempts: PuzzleAttempt[]): number =>
	attempts.reduce((total, attempt) => total + attempt.durationMs, 0);

const lastAttemptAt = (attempts: PuzzleAttempt[]): Date | null =>
	attempts.reduce<Date | null>(
		(latest, attempt) =>
			null === latest || attempt.updatedAt > latest ? attempt.updatedAt : latest,
		null,
	);
