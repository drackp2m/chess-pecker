import { Injectable } from '@nestjs/common';

import { CalibrationRoundKind } from '../definition/calibration-round-kind.enum';
import { CalibrationRoundOutcome } from '../definition/calibration-round-outcome.enum';
import { TrainingPolicy } from '../definition/training-policy';
import { TrainingStatus } from '../definition/training-status.enum';
import { PuzzleAttempt } from '../puzzle-attempt.entity';
import { TrainingCalibrationRound } from '../training-calibration-round.entity';
import { TrainingCalibrationRoundRepository } from '../training-calibration-round.repository';
import { TrainingRepository } from '../training.repository';
import { clampRatingBucket, ratingBucketSize } from '../util/rating-bucket.util';

@Injectable()
export class CloseCalibrationRoundUseCase {
	/** Tope de afinados: sin él, oscilar entre dos centenas no acabaría nunca. */
	private static readonly maxRefineRounds = 6;

	constructor(
		private readonly calibrationRoundRepository: TrainingCalibrationRoundRepository,
		private readonly trainingRepository: TrainingRepository,
	) {}

	/**
	 * Se llama cuando la ronda ya tiene todos sus intentos. Un sondeo se cierra con el único
	 * ejercicio: acertado, hay que subir; fallado, bajar. Un afinado mira la tasa de acierto,
	 * buscando la franja donde el usuario acierta entre el 80 y el 90%.
	 */
	async execute(
		round: TrainingCalibrationRound,
		attempts: PuzzleAttempt[],
		previousRounds: TrainingCalibrationRound[],
	): Promise<CalibrationRoundOutcome> {
		const outcome = CloseCalibrationRoundUseCase.resolveOutcome(round, attempts, previousRounds);

		await this.calibrationRoundRepository.updateOutcome(round.uuid, outcome);

		// Aceptar la franja cierra la calibración: a partir de aquí toca elegir el set y el
		// ritmo, que es la siguiente fase del entrenamiento.
		if (CalibrationRoundOutcome.Accept === outcome) {
			await this.trainingRepository.updateStatus(round.training.uuid, TrainingStatus.Planning);
		}

		return outcome;
	}

	private static resolveOutcome(
		round: TrainingCalibrationRound,
		attempts: PuzzleAttempt[],
		previousRounds: TrainingCalibrationRound[],
	): CalibrationRoundOutcome {
		const solved = attempts.filter((attempt) => attempt.solved).length;

		if (CalibrationRoundKind.Scan === round.kind) {
			return 0 < solved ? CalibrationRoundOutcome.Raise : CalibrationRoundOutcome.Lower;
		}

		const refines = previousRounds.filter(
			(previous) => CalibrationRoundKind.Refine === previous.kind,
		);

		if (CloseCalibrationRoundUseCase.maxRefineRounds <= refines.length) {
			return CalibrationRoundOutcome.Accept;
		}

		const accuracy = 0 === attempts.length ? 0 : solved / attempts.length;
		const direction = resolveDirection(accuracy);

		if (CalibrationRoundOutcome.Accept === direction) {
			return direction;
		}

		const next =
			CalibrationRoundOutcome.Raise === direction
				? round.rating + ratingBucketSize
				: round.rating - ratingBucketSize;

		// Si el catálogo se acaba, o si ya se probó esa franja y devolvió aquí, seguir
		// buscando es dar vueltas: la actual es la mejor respuesta que hay.
		const alreadyTried = refines.some((refine) => refine.rating === next);

		if (next !== clampRatingBucket(next) || alreadyTried) {
			return CalibrationRoundOutcome.Accept;
		}

		return direction;
	}
}

/**
 * Se busca la franja donde el usuario acierta entre el 80 y el 90%: por encima el nivel se
 * le queda corto, por debajo se le pasa, y en medio es donde el método rinde.
 */
const resolveDirection = (accuracy: number): CalibrationRoundOutcome => {
	if (accuracy > TrainingPolicy.refineUpperAccuracy) {
		return CalibrationRoundOutcome.Raise;
	}

	return accuracy < TrainingPolicy.refineLowerAccuracy
		? CalibrationRoundOutcome.Lower
		: CalibrationRoundOutcome.Accept;
};
