import { TestBed } from '@angular/core/testing';
import type { TrainingActivityDay } from '@chesspecker/api-definitions';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AttemptRepository } from '@app/repository/attempt.repository';
import type { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { ActivityAggregateUseCase } from '@app/use-case/activity-aggregate.use-case';

const TODAY = new Date('2026-09-02T12:00:00.000Z');

function attempt(over: Partial<AttemptRow> = {}): AttemptRow {
	return {
		uuid: 'attempt',
		trainingUuid: 'training',
		kind: 'cycle',
		cycleItemUuid: 'item',
		puzzleUuid: 'puzzle',
		lichessId: 'lichess',
		durationMs: 1000,
		record: [],
		freePlayRuns: [],
		solved: true,
		closure: 'found',
		hintUsed: false,
		mistakeCount: 0,
		createdAt: new Date('2026-09-02T10:00:00.000Z'),
		updatedAt: new Date('2026-09-02T10:00:00.000Z'),
		...over,
	};
}

function configure(rows: readonly AttemptRow[]) {
	const within = (from: Date, to: Date) =>
		rows.filter((row) => row.updatedAt >= from && row.updatedAt <= to);
	const repository = {
		findRangeByUpdatedAt: vi.fn((from: Date, to: Date) => Promise.resolve(within(from, to))),
		countRangeByUpdatedAt: vi.fn((from: Date, to: Date) =>
			Promise.resolve(within(from, to).length),
		),
	};

	TestBed.configureTestingModule({
		providers: [{ provide: AttemptRepository, useValue: repository }, ActivityAggregateUseCase],
	});

	return { aggregate: TestBed.inject(ActivityAggregateUseCase), repository };
}

function day(days: readonly TrainingActivityDay[], date: string): TrainingActivityDay {
	const result = days.find((item) => item.date === date);

	if (undefined === result) {
		throw new Error(`Missing activity day ${date}`);
	}

	return result;
}

describe('ActivityAggregateUseCase.read', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('aggregates every activity metric from local attempts', async () => {
		const { aggregate } = configure([
			attempt(),
			attempt({ solved: false, hintUsed: true, mistakeCount: 2 }),
			attempt({ solved: false, closure: 'revealed', mistakeCount: 1 }),
			attempt({ solved: false, closure: 'revealed', hintUsed: true, durationMs: 2000 }),
		]);

		const result = day(await aggregate.read(1, 'UTC', TODAY), '2026-09-02');

		expect(result).toEqual({
			date: '2026-09-02',
			done: 4,
			firstTry: 1,
			afterMiss: 1,
			shown: 2,
			foundClean: 1,
			foundHinted: 0,
			foundMissed: 0,
			foundMissedHinted: 1,
			revealed: 1,
			revealedHinted: 1,
			mistakes: 3,
			hints: 2,
			durationMs: 5000,
		});
	});

	it('assigns an attempt to the requested civil date', async () => {
		const { aggregate } = configure([attempt({ updatedAt: new Date('2026-09-02T00:30:00.000Z') })]);

		const utc = await aggregate.read(1, 'UTC', new Date('2026-09-02T00:30:00.000Z'));
		const losAngeles = await aggregate.read(
			1,
			'America/Los_Angeles',
			new Date('2026-09-02T00:30:00.000Z'),
		);

		expect(day(utc, '2026-09-02').done).toBe(1);
		expect(day(losAngeles, '2026-09-01').done).toBe(1);
	});

	it('fills requested days with zeroes and excludes attempts outside the range', async () => {
		const { aggregate, repository } = configure([
			attempt({ updatedAt: new Date('2026-09-01T10:00:00.000Z') }),
		]);

		const result = await aggregate.read(3, 'UTC', TODAY);

		expect(result).toHaveLength(3);
		expect(day(result, '2026-08-31').done).toBe(0);
		expect(day(result, '2026-09-01').done).toBe(1);
		expect(day(result, '2026-09-02').done).toBe(0);
		expect(repository.findRangeByUpdatedAt).toHaveBeenCalledTimes(2);
	});

	it('reuses a cached month when its row count has not moved', async () => {
		const { aggregate, repository } = configure([
			attempt({ updatedAt: new Date('2026-08-15T10:00:00.000Z') }),
			attempt({ updatedAt: new Date('2026-09-01T10:00:00.000Z') }),
		]);

		const first = await aggregate.read(20, 'UTC', TODAY);
		const second = await aggregate.read(20, 'UTC', TODAY);

		expect(repository.findRangeByUpdatedAt).toHaveBeenCalledTimes(2);
		expect(second).toEqual(first);
	});

	it('recomputes only the month a new attempt touches', async () => {
		const rows = [
			attempt({ updatedAt: new Date('2026-08-15T10:00:00.000Z') }),
			attempt({ updatedAt: new Date('2026-09-01T10:00:00.000Z') }),
		];
		const { aggregate, repository } = configure(rows);

		await aggregate.read(20, 'UTC', TODAY);

		rows.push(attempt({ updatedAt: new Date('2026-09-02T10:00:00.000Z') }));
		const result = await aggregate.read(20, 'UTC', TODAY);

		expect(repository.findRangeByUpdatedAt).toHaveBeenCalledTimes(3);
		expect(day(result, '2026-08-15').done).toBe(1);
		expect(day(result, '2026-09-02').done).toBe(1);
	});
});
