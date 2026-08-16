import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AttemptRepository } from '@app/repository/attempt.repository';
import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { PuzzleRow } from '@app/repository/definition/puzzle-schema.interface';
import {
	CalibrationPuzzleRow,
	CycleItemRow,
	TrainingCycleRow,
} from '@app/repository/definition/training-schema.interface';
import { PuzzleRepository } from '@app/repository/puzzle.repository';
import { TrainingLocalRepository } from '@app/repository/training-local.repository';
import { LocalCycleUseCase } from '@app/use-case/local-cycle.use-case';
import { TrainingHistoryUseCase } from '@app/use-case/training-history.use-case';

const TRAINING = 'training-1';

const CYCLE = {
	uuid: 'cycle-2',
	index: 2,
	status: 'running',
	createdAt: new Date('2026-08-11T09:00:00.000Z'),
} as TrainingCycleRow;

const EARLIER_CYCLE = {
	uuid: 'cycle-1',
	index: 1,
	status: 'finished',
	createdAt: new Date('2026-08-01T09:00:00.000Z'),
} as TrainingCycleRow;

function row(over: Partial<AttemptRow> = {}): AttemptRow {
	return {
		uuid: `attempt-${over.slotId ?? 'x'}`,
		trainingUuid: TRAINING,
		kind: 'cycle',
		slotId: 'item-1',
		cycleItemUuid: 'item-1',
		puzzleUuid: 'puzzle-1',
		lichessId: 'AAA11',
		durationMs: 1000,
		record: ['g8h8'],
		explorations: [],
		closure: 'found',
		hintUsed: false,
		mistakeCount: 0,
		createdAt: new Date('2026-08-11T10:00:00.000Z'),
		updatedAt: new Date('2026-08-11T10:00:30.000Z'),
		...over,
	};
}

function puzzleRow(lichessId: string): PuzzleRow {
	return {
		uuid: `uuid-${lichessId}`,
		lichessId,
		fen: '6k1/5ppp/8/8/8/8/8/R5K1 b - - 0 1',
		moves: ['g8h8', 'a1a8'],
		rating: 1500,
		themes: ['backRankMate'],
		createdAt: new Date('2026-08-01T00:00:00.000Z'),
		updatedAt: new Date('2026-08-01T00:00:00.000Z'),
	};
}

function item(uuid: string, position: number): CycleItemRow {
	return { uuid, position, cycleUuid: CYCLE.uuid } as CycleItemRow;
}

function dealt(lichessId: string, position: number, roundUuid: string): CalibrationPuzzleRow {
	return { lichessId, position, roundUuid } as CalibrationPuzzleRow;
}

const DEFAULT_ITEMS = [item('item-1', 0), item('item-2', 1)];

function configure(
	rows: readonly AttemptRow[],
	options: {
		cycles?: readonly TrainingCycleRow[];
		items?: readonly CycleItemRow[];
		dealt?: readonly CalibrationPuzzleRow[];
	} = {},
) {
	const puzzles = new Map(
		rows.map((stored) => [stored.lichessId, puzzleRow(stored.lichessId)] as const),
	);
	const cycles = {
		listCycles: vi.fn().mockResolvedValue(options.cycles ?? [CYCLE]),
		listItems: vi.fn().mockResolvedValue(options.items ?? DEFAULT_ITEMS),
	};
	const local = {
		findAllByIndex: vi.fn().mockResolvedValue(options.dealt ?? []),
	};

	TestBed.configureTestingModule({
		providers: [
			{ provide: AttemptRepository, useValue: { findAllByIndex: vi.fn().mockResolvedValue(rows) } },
			{
				provide: PuzzleRepository,
				useValue: {
					find: vi.fn((_store: string, key: string) => Promise.resolve(puzzles.get(key))),
				},
			},
			{ provide: TrainingLocalRepository, useValue: local },
			{ provide: LocalCycleUseCase, useValue: cycles },
		],
	});

	return { cycles, local, puzzles, history: TestBed.inject(TrainingHistoryUseCase) };
}

describe('TrainingHistoryUseCase', () => {
	beforeEach(() => {
		TestBed.resetTestingModule();
	});

	it('lists what the pass has finished, oldest first', async () => {
		const { history } = configure([
			row({
				slotId: 'item-2',
				cycleItemUuid: 'item-2',
				lichessId: 'BBB22',
				updatedAt: new Date('2026-08-12T10:00:00Z'),
			}),
			row({
				slotId: 'item-1',
				cycleItemUuid: 'item-1',
				lichessId: 'AAA11',
				updatedAt: new Date('2026-08-11T10:00:00Z'),
			}),
		]);

		const entries = await history.list({ trainingUuid: TRAINING, kind: 'cycle' });

		expect(entries.map((entry) => entry.puzzle.id)).toEqual(['AAA11', 'BBB22']);
		expect(entries[0]?.row.slotId).toBe('item-1');
	});

	it('numbers every exercise by its place in the pass', async () => {
		const { history } = configure([
			row({ slotId: 'item-2', cycleItemUuid: 'item-2', lichessId: 'BBB22' }),
		]);

		const [entry] = await history.list({ trainingUuid: TRAINING, kind: 'cycle' });

		expect(entry?.position).toBe(2);
		expect(entry?.total).toBe(2);
	});

	it('leaves out the exercise that is still being solved', async () => {
		const { history } = configure([
			row({ slotId: 'item-1', cycleItemUuid: 'item-1', lichessId: 'AAA11' }),
			row({
				slotId: 'item-2',
				cycleItemUuid: 'item-2',
				lichessId: 'BBB22',
				closure: 'open',
			}),
		]);

		const entries = await history.list({ trainingUuid: TRAINING, kind: 'cycle' });

		expect(entries.map((entry) => entry.puzzle.id)).toEqual(['AAA11']);
	});

	it('cuts the history at the pass the run is in', async () => {
		const { history } = configure(
			[
				row({
					slotId: 'old',
					cycleItemUuid: 'item-old',
					lichessId: 'AAA11',
					updatedAt: new Date('2026-08-01T10:00:00.000Z'),
				}),
				row({ slotId: 'new', cycleItemUuid: 'item-1', lichessId: 'BBB22' }),
			],
			{ cycles: [EARLIER_CYCLE, CYCLE], items: [item('item-1', 0)] },
		);

		const entries = await history.list({ trainingUuid: TRAINING, kind: 'cycle' });

		expect(entries.map((entry) => entry.row.slotId)).toEqual(['new']);
	});

	it('numbers a restored exercise from its own row, without the pass order here', async () => {
		const { history } = configure(
			[row({ slotId: 'item-9', cycleItemUuid: 'item-9', lichessId: 'BBB22', position: 8 })],
			{ items: [item('item-1', 0)] },
		);

		const [entry] = await history.list({ trainingUuid: TRAINING, kind: 'cycle' });

		expect(entry?.position).toBe(9);
	});

	it('keeps an exercise of the pass whose place is not known here', async () => {
		const { history } = configure(
			[row({ slotId: 'item-2', cycleItemUuid: 'item-2', lichessId: 'BBB22' })],
			{ items: [item('item-1', 0)] },
		);

		const [entry] = await history.list({ trainingUuid: TRAINING, kind: 'cycle' });

		expect(entry?.row.slotId).toBe('item-2');
		expect(entry?.position).toBeNull();
	});

	it('has nothing to show when the pass cannot be told apart', async () => {
		const { history } = configure([row()], { cycles: [] });

		expect(await history.list({ trainingUuid: TRAINING, kind: 'cycle' })).toEqual([]);
	});

	it('keeps a calibration inside its own round', async () => {
		const { history } = configure(
			[
				row({ kind: 'calibration', slotId: 'a', lichessId: 'AAA11', roundUuid: 'round-1' }),
				row({ kind: 'calibration', slotId: 'b', lichessId: 'BBB22', roundUuid: 'round-2' }),
			],
			{ dealt: [dealt('BBB22', 0, 'round-2')] },
		);

		const entries = await history.list({
			trainingUuid: TRAINING,
			kind: 'calibration',
			roundUuid: 'round-2',
		});

		expect(entries.map((entry) => entry.row.slotId)).toEqual(['b']);
		expect(entries[0]?.position).toBe(1);
	});

	it('drops an attempt whose exercise is no longer cached', async () => {
		const { history, puzzles } = configure([
			row({ slotId: 'item-1', cycleItemUuid: 'item-1', lichessId: 'AAA11' }),
			row({ slotId: 'item-2', cycleItemUuid: 'item-2', lichessId: 'BBB22' }),
		]);

		puzzles.delete('BBB22');

		const entries = await history.list({ trainingUuid: TRAINING, kind: 'cycle' });

		expect(entries.map((entry) => entry.puzzle.id)).toEqual(['AAA11']);
	});
});
