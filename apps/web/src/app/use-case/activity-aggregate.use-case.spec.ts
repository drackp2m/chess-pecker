import { TestBed } from '@angular/core/testing';
import type { TrainingActivityDay } from '@chesspecker/api-definitions';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AttemptRepository } from '@app/repository/attempt.repository';
import type { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { countDateTimeFormats } from '@app/testing/intl.harness';
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

function total(days: readonly TrainingActivityDay[]): number {
	return days.reduce((sum, item) => sum + item.done, 0);
}

describe('ActivityAggregateUseCase.read', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
		vi.unstubAllGlobals();
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

	it('counts an attempt once when the local day sits in the padding of two months', async () => {
		const { aggregate } = configure([attempt({ updatedAt: new Date('2026-09-01T06:00:00.000Z') })]);

		const result = await aggregate.read(5, 'America/Los_Angeles', TODAY);

		expect(day(result, '2026-08-31').done).toBe(1);
		expect(total(result)).toBe(1);
	});

	it('moves an attempt into the next month on a zone ahead of UTC', async () => {
		const { aggregate } = configure([attempt({ updatedAt: new Date('2026-08-31T12:00:00.000Z') })]);

		const result = await aggregate.read(5, 'Pacific/Kiritimati', TODAY);

		expect(result.at(-1)?.date).toBe('2026-09-03');
		expect(day(result, '2026-09-01').done).toBe(1);
		expect(total(result)).toBe(1);
	});

	it('keeps every attempt of a 25-hour fall-back day on that day', async () => {
		const { aggregate } = configure([
			attempt({ updatedAt: new Date('2026-10-24T21:30:00.000Z') }),
			attempt({ updatedAt: new Date('2026-10-24T22:30:00.000Z') }),
			attempt({ updatedAt: new Date('2026-10-25T22:30:00.000Z') }),
			attempt({ updatedAt: new Date('2026-10-25T23:30:00.000Z') }),
		]);

		const result = await aggregate.read(3, 'Europe/Madrid', new Date('2026-10-26T12:00:00.000Z'));

		expect(result.map((item) => [item.date, item.done])).toEqual([
			['2026-10-24', 1],
			['2026-10-25', 2],
			['2026-10-26', 1],
		]);
	});

	it('aggregates a range that crosses the new year in the requested zone', async () => {
		const { aggregate, repository } = configure([
			attempt({ updatedAt: new Date('2026-12-31T20:00:00.000Z') }),
			attempt({ updatedAt: new Date('2027-01-01T05:00:00.000Z') }),
			attempt({ updatedAt: new Date('2027-01-01T09:00:00.000Z') }),
		]);

		const result = await aggregate.read(
			5,
			'America/Los_Angeles',
			new Date('2027-01-02T12:00:00.000Z'),
		);

		expect(result.map((item) => item.date)).toEqual([
			'2026-12-29',
			'2026-12-30',
			'2026-12-31',
			'2027-01-01',
			'2027-01-02',
		]);
		expect(day(result, '2026-12-31').done).toBe(2);
		expect(day(result, '2027-01-01').done).toBe(1);
		expect(repository.findRangeByUpdatedAt).toHaveBeenCalledTimes(2);
	});

	it('never serves a month cached for another zone', async () => {
		const { aggregate, repository } = configure([
			attempt({ updatedAt: new Date('2026-09-01T06:00:00.000Z') }),
		]);

		const utc = await aggregate.read(5, 'UTC', TODAY);
		const losAngeles = await aggregate.read(5, 'America/Los_Angeles', TODAY);
		const utcAgain = await aggregate.read(5, 'UTC', TODAY);

		expect(day(utc, '2026-09-01').done).toBe(1);
		expect(day(losAngeles, '2026-08-31').done).toBe(1);
		expect(day(losAngeles, '2026-09-01').done).toBe(0);
		expect(utcAgain).toEqual(utc);
		expect(repository.findRangeByUpdatedAt).toHaveBeenCalledTimes(4);
	});

	it('caps the range at 53 weeks', async () => {
		const { aggregate } = configure([]);

		const result = await aggregate.read(10_000, 'UTC', TODAY);

		expect(result).toHaveLength(53 * 7);
		expect(result[0]?.date).toBe('2025-08-28');
		expect(result.at(-1)?.date).toBe('2026-09-02');
	});

	it('labels thousands of attempts with a single formatter for the zone', async () => {
		const beforeMidnight = new Date('2026-09-01T20:29:00.000Z');
		const afterMidnight = new Date('2026-09-01T20:30:00.000Z');
		const rows = Array.from({ length: 5000 }, (_unused, index) =>
			attempt({
				uuid: `attempt-${String(index)}`,
				updatedAt: 0 === index % 2 ? beforeMidnight : afterMidnight,
			}),
		);
		const { aggregate } = configure(rows);
		const built = countDateTimeFormats();

		const result = await aggregate.read(2, 'Asia/Tehran', TODAY);

		expect(built.filter((zone) => 'Asia/Tehran' === zone)).toHaveLength(1);
		expect(day(result, '2026-09-01').done).toBe(2500);
		expect(day(result, '2026-09-02').done).toBe(2500);
	});
});
