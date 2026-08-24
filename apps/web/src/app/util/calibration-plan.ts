import type { CalibrationRoundKind, CalibrationRoundOutcome } from '@chesspecker/api-definitions';

import { TrainingPolicy } from '@app/definition/training-policy.constant';
import { RATING_BUCKET_SIZE, clampRatingBucket } from '@app/util/rating-bucket';

export interface CalibrationRoundPlan {
	readonly kind: CalibrationRoundKind;
	readonly rating: number;
	readonly outcome: CalibrationRoundOutcome;
}

export interface CalibrationRoundTarget {
	readonly kind: CalibrationRoundKind;
	readonly rating: number;
}

export interface CalibrationAttemptGrade {
	readonly solved?: boolean;
}

export function resolveNextRound(rounds: readonly CalibrationRoundPlan[]): CalibrationRoundTarget {
	const explorations = rounds.filter((round) => 'exploration' === round.kind);

	let rating: number = TrainingPolicy.explorationStartRating;
	let step: number = TrainingPolicy.explorationInitialStep;

	for (const exploration of explorations) {
		rating = clampRatingBucket(
			'raise' === exploration.outcome ? exploration.rating + step : exploration.rating - step,
		);

		step = Math.max(RATING_BUCKET_SIZE, halveStep(step));
	}

	if (explorations.length < TrainingPolicy.explorationRounds) {
		return { kind: 'exploration', rating };
	}

	for (const refine of rounds.filter((round) => 'refine' === round.kind)) {
		rating = clampRatingBucket(refine.rating + refineStep(refine.outcome));
	}

	return { kind: 'refine', rating };
}

export function roundPuzzleCount(kind: CalibrationRoundKind): number {
	return 'exploration' === kind ? 1 : TrainingPolicy.refinePuzzles;
}

export function resolveRoundOutcome(
	round: CalibrationRoundPlan,
	attempts: readonly CalibrationAttemptGrade[],
	previousRounds: readonly CalibrationRoundPlan[],
): CalibrationRoundOutcome {
	const solved = attempts.filter((attempt) => true === attempt.solved).length;

	if ('exploration' === round.kind) {
		return 0 < solved ? 'raise' : 'lower';
	}

	const refines = previousRounds.filter((previous) => 'refine' === previous.kind);

	if (TrainingPolicy.maxRefineRounds <= refines.length) {
		return 'accept';
	}

	const direction = resolveDirection(0 === attempts.length ? 0 : solved / attempts.length);

	if ('accept' === direction) {
		return direction;
	}

	const next =
		'raise' === direction ? round.rating + RATING_BUCKET_SIZE : round.rating - RATING_BUCKET_SIZE;
	const alreadyTried = refines.some((refine) => refine.rating === next);

	return next !== clampRatingBucket(next) || alreadyTried ? 'accept' : direction;
}

const resolveDirection = (accuracy: number): CalibrationRoundOutcome => {
	if (accuracy > TrainingPolicy.refineUpperAccuracy) {
		return 'raise';
	}

	return accuracy < TrainingPolicy.refineLowerAccuracy ? 'lower' : 'accept';
};

const refineStep = (outcome: CalibrationRoundOutcome): number => {
	if ('raise' === outcome) {
		return RATING_BUCKET_SIZE;
	}

	return 'lower' === outcome ? -RATING_BUCKET_SIZE : 0;
};

const halveStep = (step: number): number =>
	Math.round(step / 2 / RATING_BUCKET_SIZE) * RATING_BUCKET_SIZE;
