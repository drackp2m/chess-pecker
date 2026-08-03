import type {
	ApiPuzzle,
	CalibrationRound,
	CalibrationRoundOutcome,
} from '@chesspecker/api-definitions';

export type TrainingRunMode = 'calibration' | 'cycle';
export type TrainingRunResult = 'solved' | 'failed';

/** One exercise on the board, with whatever the API needs to record its attempt. */
export interface TrainingRunSlot {
	readonly puzzle: ApiPuzzle;
	readonly cycleItemUuid: string | null;
	readonly position: number | null;
}

export interface TrainingRunProps {
	mode: TrainingRunMode | null;
	trainingUuid: string | null;
	round: CalibrationRound | null;
	/** 1-indexed position of `current` among the round's exercises, calibration only. */
	roundPosition: number | null;
	roundTotal: number | null;
	/** What the round decided once its last exercise was graded, calibration only. */
	roundOutcome: CalibrationRoundOutcome | null;
	current: TrainingRunSlot | null;
	/** Already fetched, waiting for the user to leave the graded exercise behind. */
	pending: TrainingRunSlot | null;
	queue: readonly ApiPuzzle[];
	lastResult: TrainingRunResult | null;
	isDone: boolean;
	isLoading: boolean;
	isSubmitting: boolean;
	error: string | null;
	notice: string | null;
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

export function toSlot(puzzle: ApiPuzzle): TrainingRunSlot {
	return {
		puzzle,
		cycleItemUuid: null,
		position: null,
	};
}

export function describeOutcome(outcome: CalibrationRoundOutcome): string {
	switch (outcome) {
		case 'accept':
			return 'Calibration done — that band is your level.';
		case 'raise':
			return 'Solved it. The next round probes higher.';
		case 'lower':
			return 'Missed it. The next round probes lower.';
		case 'pending':
			return '';
	}
}
