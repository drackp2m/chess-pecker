import type {
	CalibrationRoundProgress,
	CycleProgress,
	TrainingProgress,
} from '@chesspecker/api-definitions';

import type { TranslationRef } from '@app/definition/i18n.type';
import { I18n, i18nRef } from '@app/i18n';

export interface TrainingSummaryRow {
	readonly key: string;
	readonly stage: TranslationRef;
	readonly stageDetail: string;
	readonly firstTry: string;
	readonly result: TranslationRef;
	readonly resultDetail: string;
}

export interface TrainingSummary {
	readonly rows: readonly TrainingSummaryRow[];
	readonly firstTry: number;
	readonly total: number;
	readonly percentage: string;
	readonly rating: number | null;
	/** The phase being played right now, when it is not the whole training already. */
	readonly current: TranslationRef | null;
}

/**
 * The training as one sequence: every round and cycle in the order played. Null until
 * there is anything to show, which is what hides the table.
 */
export function toTrainingSummary(progress: TrainingProgress | null): TrainingSummary | null {
	if (null === progress) {
		return null;
	}

	const rounds = progress.calibration.rounds;
	const rows = [...rounds.map(toRoundRow), ...progress.cycles.map(toCycleRow)];

	if (0 === rows.length) {
		return null;
	}

	const stages = [...rounds, ...progress.cycles];
	const firstTry = sumFirstTry(stages);
	const total = sumTotal(stages);
	const current = resolveCurrent(progress);

	return {
		rows,
		firstTry,
		total,
		percentage: percentage(firstTry, total),
		rating: progress.calibration.rating,
		current: null !== current && current.total !== total ? current.text : null,
	};
}

interface TrainingStage {
	readonly solved: number;
	readonly total: number;
}

interface TrainingStageSummary {
	readonly total: number;
	readonly text: TranslationRef;
}

interface StageCounts {
	readonly firstTry: number;
	readonly total: number;
	readonly percentage: string;
}

const ROUND_STAGE = {
	scan: I18n.common.EXPLORATION,
	refine: I18n.common.REFINE,
} as const satisfies Record<CalibrationRoundProgress['kind'], string>;

/** How the phase is named when it is the one being played, not a row of the log. */
const PHASE_STAGE = {
	scan: I18n.dashboard.TRAINING_CURRENT_EXPLORATIONS,
	refine: I18n.dashboard.TRAINING_CURRENT_REFINEMENT,
} as const satisfies Record<CalibrationRoundProgress['kind'], string>;

const ROUND_RESULT = {
	pending: I18n.common.IN_PROGRESS,
	raise: I18n.common.RESULT_RAISE,
	lower: I18n.common.RESULT_LOWER,
	accept: I18n.common.LEVEL_FOUND,
} as const satisfies Record<CalibrationRoundProgress['outcome'], string>;

const CYCLE_RESULT = {
	running: I18n.common.RUNNING,
	finished: I18n.common.FINISHED,
	abandoned: I18n.common.CANCELLED,
} as const satisfies Record<CycleProgress['status'], string>;

/**
 * An open round counts against everything it dealt, not against what has been answered so
 * far: the exercises left are part of it, and the board says so while they are played.
 */
const toRoundRow = (round: CalibrationRoundProgress): TrainingSummaryRow => ({
	key: `round-${round.uuid}`,
	stage: i18nRef(ROUND_STAGE[round.kind]),
	stageDetail: `· ELO ${round.rating.toString()}`,
	firstTry: ratio(round.solved, round.total),
	result: i18nRef(ROUND_RESULT[round.outcome]),
	resultDetail: '',
});

/** A cycle is long enough that how far into it you are matters as much as how it went. */
const toCycleRow = (cycle: CycleProgress): TrainingSummaryRow => ({
	key: `cycle-${cycle.uuid}`,
	stage: i18nRef(I18n.common.CYCLE, { index: cycle.index }),
	stageDetail: '',
	firstTry: ratio(cycle.solved, cycle.total),
	result: i18nRef(CYCLE_RESULT[cycle.status]),
	resultDetail: 'running' === cycle.status ? `· ${ratio(cycle.attempted, cycle.total)}` : '',
});

/**
 * The explorations, the refinement or one cycle — whichever is open. A phase is read whole, so
 * the rounds of the open one count together however many of them it took.
 */
const resolveCurrent = (progress: TrainingProgress): TrainingStageSummary | null => {
	const rounds = progress.calibration.rounds;
	const open = rounds.find((round) => 'pending' === round.outcome);

	if (undefined !== open) {
		const counts = toStageCounts(rounds.filter((round) => round.kind === open.kind));

		return { total: counts.total, text: i18nRef(PHASE_STAGE[open.kind], counts) };
	}

	const running = progress.cycles.find((cycle) => 'running' === cycle.status);

	if (undefined === running) {
		return null;
	}

	const counts = toStageCounts([running]);

	return {
		total: counts.total,
		text: i18nRef(I18n.dashboard.TRAINING_CURRENT_CYCLE, { ...counts, index: running.index }),
	};
};

const toStageCounts = (stages: readonly TrainingStage[]): StageCounts => {
	const firstTry = sumFirstTry(stages);
	const total = sumTotal(stages);

	return { firstTry, total, percentage: percentage(firstTry, total) };
};

const sumFirstTry = (stages: readonly TrainingStage[]): number =>
	stages.reduce((count, stage) => count + stage.solved, 0);

const sumTotal = (stages: readonly TrainingStage[]): number =>
	stages.reduce((count, stage) => count + stage.total, 0);

const percentage = (firstTry: number, total: number): string =>
	0 === total ? '—' : `${Math.round((firstTry / total) * 100).toString()}%`;

const ratio = (part: number, whole: number): string => `${part.toString()} / ${whole.toString()}`;
