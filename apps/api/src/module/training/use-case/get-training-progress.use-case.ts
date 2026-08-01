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
	 * Todo lo que se enseña del entrenamiento sale de aquí, y todo es agregado sobre
	 * `puzzle_attempt`: ni el tiempo por ciclo ni la tasa de acierto se almacenan, porque son
	 * sumas sobre filas que ya no cambian.
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
			// ToDo => la estimación ignora las dos cosas que la harían personalizada: el
			// tiempo medio de la calibración —que es de donde sale cuántos ejercicios entran
			// en los minutos al día que el usuario quiere dedicar— y el `endDate` del
			// objetivo, que es la otra mitad del ritmo y aquí no se mira, así que un objetivo
			// fijado sólo por fecha estima `null`.
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
	 * Cada pasada se exige sobre el tiempo real de la primera, que es contra lo que el método
	 * mide el éxito. El ciclo 1 no tiene objetivo: es el listón.
	 */
	private static resolveTarget(index: number, firstCycleDurationMs: number | null): number | null {
		if (1 === index || null === firstCycleDurationMs || 0 === firstCycleDurationMs) {
			return null;
		}

		// A partir del último factor se mantiene el último: los ciclos 5, 6 y 7 se exigen como
		// el 4, que ya es "lo más rápido posible manteniendo aciertos".
		const factors = TrainingPolicy.cycleTargetFactors;
		const factor = factors[Math.min(index - 2, factors.length - 1)];

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

	/** El ELO con el que se cerró la calibración, y lo que costó llegar hasta él. */
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
	 * Ronda a ronda, que es como se lee una calibración: dónde probó, cuánto se acertó allí y
	 * hacia dónde mandó eso a la siguiente.
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
	 * Una pasada por ciclo, en orden: el objetivo de cada uno se mide contra la duración real
	 * del primero, así que hay que haberlo recorrido antes de poder exigir nada a los demás.
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
