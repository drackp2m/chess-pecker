import {
	CalibrationRoundProgress,
	CycleProgress,
	TrainingProgress,
} from '@app/definition/training.interface';

export interface ProgramSummaryRow {
	readonly key: string;
	readonly stage: string;
	readonly solved: string;
	readonly result: string;
}

export interface ProgramStageSummary {
	readonly label: string;
	readonly solved: number;
	readonly total: number;
	readonly percentage: string;
}

export interface ProgramSummary {
	readonly rows: readonly ProgramSummaryRow[];
	readonly solved: number;
	readonly total: number;
	readonly percentage: string;
	readonly rating: number | null;
	/** The phase being played right now, when it is not the whole program already. */
	readonly current: ProgramStageSummary | null;
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
		current: null !== current && current.total === total ? null : current,
	};
}

interface ProgramStage {
	readonly solved: number;
	readonly total: number;
}

const ROUND_KIND: Record<CalibrationRoundProgress['kind'], string> = {
	scan: 'Scan',
	refine: 'Refine',
};

/** How the phase is named when it is the one being played, not a row of the log. */
const PHASE_LABEL: Record<CalibrationRoundProgress['kind'], string> = {
	scan: 'the scans',
	refine: 'refinement',
};

const ROUND_RESULT: Record<CalibrationRoundProgress['outcome'], string> = {
	pending: 'In progress',
	raise: 'Probes higher',
	lower: 'Probes lower',
	accept: 'Level found',
};

const CYCLE_RESULT: Record<CycleProgress['status'], string> = {
	running: 'Running',
	finished: 'Finished',
	abandoned: 'Cancelled',
};

/**
 * An open round counts against everything it dealt, not against what has been answered so
 * far: the exercises left are part of it, and the board says so while they are played.
 */
const toRoundRow = (round: CalibrationRoundProgress): ProgramSummaryRow => ({
	key: `round-${round.uuid}`,
	stage: `${ROUND_KIND[round.kind]} · ELO ${round.rating.toString()}`,
	solved: ratio(round.solved, round.total),
	result: ROUND_RESULT[round.outcome],
});

/** A cycle is long enough that how far into it you are matters as much as how it went. */
const toCycleRow = (cycle: CycleProgress): ProgramSummaryRow => ({
	key: `cycle-${cycle.uuid}`,
	stage: `Cycle ${cycle.index.toString()}`,
	solved: ratio(cycle.solved, cycle.total),
	result:
		'running' === cycle.status
			? `${CYCLE_RESULT[cycle.status]} · ${ratio(cycle.attempted, cycle.total)}`
			: CYCLE_RESULT[cycle.status],
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
			PHASE_LABEL[open.kind],
			rounds.filter((round) => round.kind === open.kind),
		);
	}

	const running = progress.cycles.find((cycle) => 'running' === cycle.status);

	return undefined === running
		? null
		: toStageSummary(`cycle ${running.index.toString()}`, [running]);
};

const toStageSummary = (label: string, stages: readonly ProgramStage[]): ProgramStageSummary => {
	const solved = sumSolved(stages);
	const total = sumTotal(stages);

	return { label, solved, total, percentage: percentage(solved, total) };
};

const sumSolved = (stages: readonly ProgramStage[]): number =>
	stages.reduce((count, stage) => count + stage.solved, 0);

const sumTotal = (stages: readonly ProgramStage[]): number =>
	stages.reduce((count, stage) => count + stage.total, 0);

const percentage = (solved: number, total: number): string =>
	0 === total ? '—' : `${Math.round((solved / total) * 100).toString()}%`;

const ratio = (part: number, whole: number): string => `${part.toString()} / ${whole.toString()}`;
