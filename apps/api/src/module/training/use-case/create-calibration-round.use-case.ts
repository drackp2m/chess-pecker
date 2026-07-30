import { Injectable } from '@nestjs/common';

import { PreconditionFailedException } from '../../../shared/exception/precondition-failed.exception';
import { Puzzle } from '../../puzzle/puzzle.entity';
import { PuzzleRepository } from '../../puzzle/puzzle.repository';
import { CalibrationRoundKind } from '../definition/calibration-round-kind.enum';
import { CalibrationRoundOutcome } from '../definition/calibration-round-outcome.enum';
import { TrainingPolicy } from '../definition/training-policy';
import { TrainingStatus } from '../definition/training-status.enum';
import { TrainingCalibrationPuzzle } from '../training-calibration-puzzle.entity';
import { TrainingCalibrationPuzzleRepository } from '../training-calibration-puzzle.repository';
import { TrainingCalibrationRound } from '../training-calibration-round.entity';
import { TrainingCalibrationRoundRepository } from '../training-calibration-round.repository';
import { Training } from '../training.entity';
import {
	clampRatingBucket,
	ratingBucketCeiling,
	ratingBucketSize,
} from '../util/rating-bucket.util';

@Injectable()
export class CreateCalibrationRoundUseCase {
	constructor(
		private readonly calibrationRoundRepository: TrainingCalibrationRoundRepository,
		private readonly calibrationPuzzleRepository: TrainingCalibrationPuzzleRepository,
		private readonly puzzleRepository: PuzzleRepository,
	) {}

	async execute(
		training: Training,
	): Promise<{ round: TrainingCalibrationRound; puzzles: Puzzle[] }> {
		if (TrainingStatus.Calibrating !== training.status) {
			throw new PreconditionFailedException('not calibrating', 'training');
		}

		const rounds = await this.calibrationRoundRepository.getManyByTraining(training.uuid);
		const last = rounds.at(-1);

		if (CalibrationRoundOutcome.Pending === last?.outcome) {
			throw new PreconditionFailedException('round in progress', 'calibration');
		}

		const { kind, rating } = CreateCalibrationRoundUseCase.resolveNext(rounds);
		const puzzles = await this.dealPuzzles(kind, rating);

		const round = await this.calibrationRoundRepository.insert(
			new TrainingCalibrationRound({ training, index: rounds.length + 1, kind, rating }),
		);

		await this.calibrationPuzzleRepository.insertMany(
			puzzles.map(
				(puzzle, position) =>
					new TrainingCalibrationPuzzle({ calibrationRound: round, puzzle, position }),
			),
		);

		return { round, puzzles };
	}

	/**
	 * Dónde toca probar ahora, reproduciendo lo que dijeron las rondas anteriores.
	 *
	 * Primero unos sondeos de un ejercicio, con salto grande que se va partiendo por la
	 * mitad, para acotar la zona sin gastar diez ejercicios en un rango que no era. Después,
	 * afinados de diez que suben o bajan de centena en centena.
	 */
	private static resolveNext(rounds: TrainingCalibrationRound[]): {
		kind: CalibrationRoundKind;
		rating: number;
	} {
		let rating: number = TrainingPolicy.scanStartRating;
		let step: number = TrainingPolicy.scanInitialStep;

		const scans = rounds.filter((round) => CalibrationRoundKind.Scan === round.kind);

		for (const scan of scans) {
			rating = clampRatingBucket(
				CalibrationRoundOutcome.Raise === scan.outcome ? scan.rating + step : scan.rating - step,
			);

			step = Math.max(ratingBucketSize, clampStep(step));
		}

		if (scans.length < TrainingPolicy.scanRounds) {
			return { kind: CalibrationRoundKind.Scan, rating };
		}

		const refines = rounds.filter((round) => CalibrationRoundKind.Refine === round.kind);

		for (const refine of refines) {
			rating = clampRatingBucket(refine.rating + refineStep(refine.outcome));
		}

		return { kind: CalibrationRoundKind.Refine, rating };
	}

	/** Los ejercicios de la ronda: un sondeo reparte uno, un afinado la tanda entera. */
	private async dealPuzzles(kind: CalibrationRoundKind, rating: number): Promise<Puzzle[]> {
		const size = CalibrationRoundKind.Scan === kind ? 1 : TrainingPolicy.refinePuzzles;

		const puzzles = await this.puzzleRepository.getManyRandomByRating(
			rating,
			ratingBucketCeiling(rating),
			size,
		);

		// Sin ejercicios suficientes la ronda no podría cerrarse nunca, así que se falla aquí
		// en lugar de dejar la calibración colgada esperando intentos que no van a llegar.
		if (puzzles.length < size) {
			throw new PreconditionFailedException('not enough puzzles', 'rating');
		}

		return puzzles;
	}
}

/** Un afinado mueve de centena en centena, o se queda donde está si acepta la franja. */
const refineStep = (outcome: CalibrationRoundOutcome): number => {
	if (CalibrationRoundOutcome.Raise === outcome) {
		return ratingBucketSize;
	}

	return CalibrationRoundOutcome.Lower === outcome ? -ratingBucketSize : 0;
};

const clampStep = (step: number): number =>
	Math.round(step / 2 / ratingBucketSize) * ratingBucketSize;
