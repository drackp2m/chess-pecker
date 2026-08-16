import type { CalibrationRoundOutcome, PuzzleAttemptRecord } from '@chesspecker/api-definitions';

import type { TranslationRef } from '@app/definition/i18n.type';
import { I18n, i18nRef } from '@app/i18n';
import { PuzzleRow } from '@app/repository/definition/puzzle-schema.interface';
import {
	CalibrationRoundRow,
	CycleItemRow,
} from '@app/repository/definition/training-schema.interface';

export type TrainingRunMode = 'calibration' | 'cycle';
export type TrainingRunResult = 'solved' | 'failed';

/** How the exercise went, minus the clock: that travels as its own `SolveTiming`. */
export type TrainingAttemptRecord = Omit<PuzzleAttemptRecord, 'durationMs'>;

/** One exercise on the board, with whatever recording its attempt needs. */
export interface TrainingRunSlot {
	readonly puzzle: PuzzleRow;
	readonly cycleItem: CycleItemRow | null;
	readonly position: number | null;
}

export interface TrainingRunProps {
	mode: TrainingRunMode | null;
	trainingUuid: string | null;
	round: CalibrationRoundRow | null;
	/** 1-indexed position of `current` among the round's exercises, calibration only. */
	roundPosition: number | null;
	roundTotal: number | null;
	/** What the round decided once its last exercise was graded, calibration only. */
	roundOutcome: CalibrationRoundOutcome | null;
	current: TrainingRunSlot | null;
	/** Already fetched, waiting for the user to leave the graded exercise behind. */
	pending: TrainingRunSlot | null;
	queue: readonly PuzzleRow[];
	lastResult: TrainingRunResult | null;
	isDone: boolean;
	isLoading: boolean;
	isSubmitting: boolean;
	error: TranslationRef | null;
	notice: TranslationRef | null;
}

export const initialState: TrainingRunProps = {
	mode: null,
	trainingUuid: null,
	round: null,
	roundPosition: null,
	roundTotal: null,
	roundOutcome: null,
	current: null,
	pending: null,
	queue: [],
	lastResult: null,
	isDone: false,
	isLoading: false,
	isSubmitting: false,
	error: null,
	notice: null,
};

export function toSlot(puzzle: PuzzleRow): TrainingRunSlot {
	return {
		puzzle,
		cycleItem: null,
		position: null,
	};
}

export function describeOutcome(outcome: CalibrationRoundOutcome): TranslationRef | null {
	switch (outcome) {
		case 'accept':
			return i18nRef(I18n.training.OUTCOME_ACCEPT);
		case 'raise':
			return i18nRef(I18n.training.OUTCOME_RAISE);
		case 'lower':
			return i18nRef(I18n.training.OUTCOME_LOWER);
		case 'pending':
			return null;
	}
}
