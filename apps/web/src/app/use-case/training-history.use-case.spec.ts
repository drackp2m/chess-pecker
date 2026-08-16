import { TestBed } from '@angular/core/testing';
import type { TrainingCycle } from '@chesspecker/api-definitions';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AttemptRepository } from '@app/repository/attempt.repository';
import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { PuzzleRow } from '@app/repository/definition/puzzle-schema.interface';
import { PuzzleRepository } from '@app/repository/puzzle.repository';
import { TrainingRunRepository } from '@app/repository/training-run.repository';
import { TrainingHistoryUseCase } from '@app/use-case/training-history.use-case';

const TRAINING = 'training-1';

const CYCLE: TrainingCycle = {
	uuid: 'cycle-2',
	index: 2,
	status: 'running',
	createdAt: '2026-08-10T00:00:00.000Z',
};

const EARLIER_CYCLE: TrainingCycle = {
	uuid: 'cycle-1',
	index: 1,
	status: 'finished',
	createdAt: '2026-08-01T00:00:00.000Z',
};

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

function configure(rows: readonly AttemptRow[], cycles: readonly TrainingCycle[] = [CYCLE]) {
	const puzzles = new Map(
		rows.map((stored) => [stored.lichessId, puzzleRow(stored.lichessId)] as const),
	);
	const runs = { listCycles: vi.fn().mockResolvedValue(cycles) };

	TestBed.configureTestingModule({
		providers: [
			{ provide: AttemptRepository, useValue: { findAllByIndex: vi.fn().mockResolvedValue(rows) } },
			{
				provide: PuzzleRepository,
				useValue: {
					find: vi.fn((_store: string, key: string) => Promise.resolve(puzzles.get(key))),
				},
			},
			{ provide: TrainingRunRepository, useValue: runs },
		],
	});

	return { runs, puzzles, history: TestBed.inject(TrainingHistoryUseCase) };
}

describe('TrainingHistoryUseCase', () => {
	beforeEach(() => {
		TestBed.resetTestingModule();
	});

	it('lists what the pass has finished, oldest first', async () => {
		const { history } = configure([
			row({ slotId: 'item-2', lichessId: 'BBB22', updatedAt: new Date('2026-08-12T10:00:00Z') }),
			row({ slotId: 'item-1', lichessId: 'AAA11', updatedAt: new Date('2026-08-11T10:00:00Z') }),
		]);

		const entries = await history.list({ trainingUuid: TRAINING, kind: 'cycle' });

		expect(entries.map((entry) => entry.puzzle.id)).toEqual(['AAA11', 'BBB22']);
		expect(entries[0]?.row.slotId).toBe('item-1');
	});

	it('leaves out the exercise that is still being solved', async () => {
		const { history } = configure([
			row({ slotId: 'item-1', lichessId: 'AAA11' }),
			row({ slotId: 'item-2', lichessId: 'BBB22', closure: 'open' }),
		]);

		const entries = await history.list({ trainingUuid: TRAINING, kind: 'cycle' });

		expect(entries.map((entry) => entry.puzzle.id)).toEqual(['AAA11']);
	});

	it('cuts the history at the pass the run is in', async () => {
		const { history } = configure(
			[
				row({ slotId: 'old', lichessId: 'AAA11', updatedAt: new Date('2026-08-02T10:00:00Z') }),
				row({ slotId: 'new', lichessId: 'BBB22', updatedAt: new Date('2026-08-11T10:00:00Z') }),
			],
			[EARLIER_CYCLE, CYCLE],
		);

		const entries = await history.list({ trainingUuid: TRAINING, kind: 'cycle' });

		expect(entries.map((entry) => entry.row.slotId)).toEqual(['new']);
	});

	it('has nothing to show when the pass cannot be told apart', async () => {
		const { history, runs } = configure([row()]);

		runs.listCycles.mockRejectedValue(new Error('offline'));

		expect(await history.list({ trainingUuid: TRAINING, kind: 'cycle' })).toEqual([]);
	});

	it('keeps a calibration inside its own round', async () => {
		const { history } = configure([
			row({ kind: 'calibration', slotId: 'a', lichessId: 'AAA11', roundUuid: 'round-1' }),
			row({ kind: 'calibration', slotId: 'b', lichessId: 'BBB22', roundUuid: 'round-2' }),
		]);

		const entries = await history.list({
			trainingUuid: TRAINING,
			kind: 'calibration',
			roundUuid: 'round-2',
		});

		expect(entries.map((entry) => entry.row.slotId)).toEqual(['b']);
	});

	it('drops an attempt whose exercise is no longer cached', async () => {
		const { history, puzzles } = configure([
			row({ slotId: 'item-1', lichessId: 'AAA11' }),
			row({ slotId: 'item-2', lichessId: 'BBB22' }),
		]);

		puzzles.delete('BBB22');

		const entries = await history.list({ trainingUuid: TRAINING, kind: 'cycle' });

		expect(entries.map((entry) => entry.puzzle.id)).toEqual(['AAA11']);
	});
});
