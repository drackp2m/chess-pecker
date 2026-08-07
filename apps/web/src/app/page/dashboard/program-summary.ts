import type {
	CalibrationRoundProgress,
	CycleProgress,
	TrainingProgress,
} from '@chesspecker/api-definitions';

import type { TranslationRef } from '@app/definition/i18n.type';
import { I18n } from '@app/i18n';

export interface ProgramSummaryRow {
	readonly key: string;
	readonly stage: TranslationRef;
	readonly stageDetail: string;
	readonly solved: string;
	readonly result: TranslationRef;
	readonly resultDetail: string;
}

export interface ProgramSummary {
	readonly rows: readonly ProgramSummaryRow[];
	readonly solved: number;
	readonly total: number;
	readonly percentage: string;
	readonly rating: number | null;
	/** The phase being played right now, when it is not the whole program already. */
	readonly current: TranslationRef | null;
}

/**
 * The program read as a single sequence: every calibration round and every cycle in the
 * order they were played, each one saying how much of it was solved and where it left the
 * training. Null until there is anything to show, which is what hides the table.
 */
export function toProgramSummary(progress: TrainingProgress | null): ProgramSummary | null {
	if (null === progress) {
		return null;
	}

	const rounds = progress.calibration.rounds;
	const rows = [...rounds.map(toRoundRow), ...progress.cycles.map(toCycleRow)];

	if (0 === rows.length) {
		return null;
	}

	const stages = [...rounds, ...progress.cycles];
	const solved = sumSolved(stages);
	const total = sumTotal(stages);
	const current = resolveCurrent(progress);

	return {
		rows,
		solved,
		total,
		percentage: percentage(solved, total),
		rating: progress.calibration.rating,
		current: null !== current && current.total !== total ? current.text : null,
	};
}

interface ProgramStage {
	readonly solved: number;
	readonly total: number;
}

interface ProgramStageSummary {
	readonly total: number;
	readonly text: TranslationRef;
}

const ROUND_STAGE: Record<CalibrationRoundProgress['kind'], string> = {
	scan: I18n.common.SCAN,
	refine: I18n.common.REFINE,
};

/** How the phase is named when it is the one being played, not a row of the log. */
const PHASE_STAGE: Record<CalibrationRoundProgress['kind'], string> = {
	scan: I18n.dashboard.PROGRAM_CURRENT_SCANS,
	refine: I18n.dashboard.PROGRAM_CURRENT_REFINE,
};

const ROUND_RESULT: Record<CalibrationRoundProgress['outcome'], string> = {
	pending: I18n.common.IN_PROGRESS,
	raise: I18n.common.PROBES_HIGHER,
	lower: I18n.common.PROBES_LOWER,
	accept: I18n.common.LEVEL_FOUND,
};

const CYCLE_RESULT: Record<CycleProgress['status'], string> = {
	running: I18n.common.RUNNING,
	finished: I18n.common.FINISHED,
	abandoned: I18n.common.CANCELLED,
};

/**
 * An open round counts against everything it dealt, not against what has been answered so
 * far: the exercises left are part of it, and the board says so while they are played.
 */
const toRoundRow = (round: CalibrationRoundProgress): ProgramSummaryRow => ({
	key: `round-${round.uuid}`,
	stage: { key: ROUND_STAGE[round.kind] },
	stageDetail: `· ELO ${round.rating.toString()}`,
	solved: ratio(round.solved, round.total),
	result: { key: ROUND_RESULT[round.outcome] },
	resultDetail: '',
});

/** A cycle is long enough that how far into it you are matters as much as how it went. */
const toCycleRow = (cycle: CycleProgress): ProgramSummaryRow => ({
	key: `cycle-${cycle.uuid}`,
	stage: { key: I18n.common.CYCLE, params: { index: cycle.index } },
	stageDetail: '',
	solved: ratio(cycle.solved, cycle.total),
	result: { key: CYCLE_RESULT[cycle.status] },
	resultDetail: 'running' === cycle.status ? `· ${ratio(cycle.attempted, cycle.total)}` : '',
});

/**
 * The scans, the refinement or one cycle — whichever is open. A phase is read whole, so
 * the rounds of the open one count together however many of them it took.
 */
const resolveCurrent = (progress: TrainingProgress): ProgramStageSummary | null => {
	const rounds = progress.calibration.rounds;
	const open = rounds.find((round) => 'pending' === round.outcome);

	if (undefined !== open) {
		return toStageSummary(
			PHASE_STAGE[open.kind],
			{},
			rounds.filter((round) => round.kind === open.kind),
		);
	}

	const running = progress.cycles.find((cycle) => 'running' === cycle.status);

	return undefined === running
		? null
		: toStageSummary(I18n.dashboard.PROGRAM_CURRENT_CYCLE, { index: running.index }, [running]);
};

const toStageSummary = (
	key: string,
	params: Record<string, unknown>,
	stages: readonly ProgramStage[],
): ProgramStageSummary => {
	const solved = sumSolved(stages);
	const total = sumTotal(stages);

	return {
		total,
		text: { key, params: { ...params, solved, total, percentage: percentage(solved, total) } },
	};
};

const sumSolved = (stages: readonly ProgramStage[]): number =>
	stages.reduce((count, stage) => count + stage.solved, 0);

const sumTotal = (stages: readonly ProgramStage[]): number =>
	stages.reduce((count, stage) => count + stage.total, 0);

const percentage = (solved: number, total: number): string =>
	0 === total ? '—' : `${Math.round((solved / total) * 100).toString()}%`;

const ratio = (part: number, whole: number): string => `${part.toString()} / ${whole.toString()}`;
