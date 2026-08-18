import { describe, expect, it } from 'vitest';

import {
	SyncableRow,
	born,
	confirmed,
	isRejected,
	rejected,
	requeued,
	touch,
} from '@app/use-case/sync/local-record';

const CREATED = new Date('2026-08-11T09:00:00.000Z');
const UPDATED = new Date('2026-08-11T09:30:00.000Z');

function row(over: Partial<SyncableRow> = {}): SyncableRow {
	return { uuid: 'row-1', createdAt: CREATED, updatedAt: UPDATED, ...over };
}

describe('born', () => {
	it('keeps its own uuid as the retry key and starts waiting', () => {
		expect(born(row())).toEqual({
			uuid: 'row-1',
			createdAt: CREATED,
			updatedAt: UPDATED,
			clientRef: 'row-1',
			pendingSince: UPDATED,
		});
	});
});

describe('touch', () => {
	it('marks a row that had nothing to upload', () => {
		const now = new Date('2026-08-11T10:00:00.000Z');

		expect(touch(row({ syncedAt: UPDATED }), now)).toMatchObject({
			updatedAt: now,
			pendingSince: now,
		});
	});

	it('does not refresh how long a row has been waiting', () => {
		const waiting = row({ pendingSince: UPDATED });
		const now = new Date('2026-08-11T10:00:00.000Z');

		expect(touch(waiting, now)).toMatchObject({ updatedAt: now, pendingSince: UPDATED });
	});
});

describe('confirmed', () => {
	const syncedAt = new Date('2026-08-11T10:00:00.000Z');

	it('seals the copy without modifying it', () => {
		expect(confirmed(row({ pendingSince: UPDATED }), syncedAt)).toEqual({
			uuid: 'row-1',
			createdAt: CREATED,
			updatedAt: UPDATED,
			syncedAt,
		});
	});

	it('drops a refusal that no longer describes the row', () => {
		const sealed = confirmed(
			row({ pendingSince: UPDATED, rejectedAt: UPDATED, rejectedReason: 'nope' }),
			syncedAt,
		);

		expect(sealed).not.toHaveProperty('rejectedAt');
		expect(sealed).not.toHaveProperty('rejectedReason');
		expect(isRejected(sealed)).toBe(false);
	});
});

describe('rejected', () => {
	const rejectedAt = new Date('2026-08-11T10:00:00.000Z');

	it('stops waiting and keeps the reason to be shown', () => {
		const refused = rejected(row({ pendingSince: UPDATED }), rejectedAt, 'unknown lichessId');

		expect(refused).toEqual({
			uuid: 'row-1',
			createdAt: CREATED,
			updatedAt: UPDATED,
			rejectedAt,
			rejectedReason: 'unknown lichessId',
		});
		expect(isRejected(refused)).toBe(true);
	});
});

describe('requeued', () => {
	it('sends a refused row back to the queue', () => {
		const pendingSince = new Date('2026-08-11T10:00:00.000Z');
		const back = requeued(row({ rejectedAt: UPDATED, rejectedReason: 'nope' }), pendingSince);

		expect(back).toEqual({
			uuid: 'row-1',
			createdAt: CREATED,
			updatedAt: UPDATED,
			pendingSince,
		});
		expect(isRejected(back)).toBe(false);
	});
});
