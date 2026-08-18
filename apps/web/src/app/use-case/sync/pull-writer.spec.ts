import type { SyncEntity } from '@chesspecker/api-definitions';
import { describe, expect, it, vi } from 'vitest';

import { PendingRow } from '@app/repository/definition/pending-schema.interface';
import { PullTransaction, absorbRow, absorbRows } from '@app/use-case/sync/pull-writer';

const ENTITY: SyncEntity = 'training';

const CREATED_AT = new Date('2026-08-01T09:00:00.000Z');

const UPDATED_AT = new Date('2026-08-18T09:00:00.000Z');

const PENDING_SINCE = new Date('2026-08-18T09:30:00.000Z');

function row(uuid: string, over: Partial<PendingRow> = {}): PendingRow {
	return { uuid, createdAt: CREATED_AT, updatedAt: UPDATED_AT, ...over };
}

function fakeTransaction(seed: readonly PendingRow[] = []) {
	const tables = new Map<string, Map<string, PendingRow>>([
		[ENTITY, new Map(seed.map((stored) => [stored.uuid, stored]))],
	]);

	const table = (entity: string): Map<string, PendingRow> => {
		const rows = tables.get(entity) ?? new Map<string, PendingRow>();

		tables.set(entity, rows);

		return rows;
	};

	const objectStore = vi.fn((entity: string) => ({
		get: vi.fn((uuid: string) => Promise.resolve(table(entity).get(uuid))),
		put: vi.fn((stored: PendingRow) => {
			table(entity).set(stored.uuid, stored);

			return Promise.resolve(stored.uuid);
		}),
	}));

	return {
		objectStore,
		transaction: { objectStore } as unknown as PullTransaction,
		stored: (uuid: string, entity: string = ENTITY) => table(entity).get(uuid),
		count: (entity: string = ENTITY) => table(entity).size,
	};
}

describe('absorbRow', () => {
	it('writes a row this device did not have', async () => {
		const { transaction, stored } = fakeTransaction();
		const coming = row('training-1');

		await expect(absorbRow(transaction, ENTITY, coming)).resolves.toBe(1);
		expect(stored('training-1')).toEqual(coming);
	});

	it('overwrites a row with nothing waiting to go up', async () => {
		const { transaction, stored } = fakeTransaction([
			row('training-1', { syncedAt: UPDATED_AT, clientRef: 'training-1' }),
		]);
		const coming = row('training-1', { updatedAt: new Date('2026-08-18T11:00:00.000Z') });

		await expect(absorbRow(transaction, ENTITY, coming)).resolves.toBe(1);
		expect(stored('training-1')).toEqual(coming);
	});

	it('leaves a row that is still waiting to go up', async () => {
		const local = row('training-1', { pendingSince: PENDING_SINCE });
		const { transaction, stored } = fakeTransaction([local]);

		await expect(
			absorbRow(transaction, ENTITY, row('training-1', { updatedAt: CREATED_AT })),
		).resolves.toBe(0);
		expect(stored('training-1')).toBe(local);
	});

	it('reads and writes the table it was given', async () => {
		const { transaction, objectStore, count } = fakeTransaction();

		await absorbRow(transaction, 'cycleItem', row('item-1'));

		expect(objectStore).toHaveBeenCalledWith('cycleItem');
		expect(count('cycleItem')).toBe(1);
		expect(count()).toBe(0);
	});

	it('does not even open the table for a branch that did not come down', async () => {
		const { transaction, objectStore } = fakeTransaction();

		await expect(absorbRow(transaction, ENTITY, undefined)).resolves.toBe(0);
		expect(objectStore).not.toHaveBeenCalled();
	});
});

describe('absorbRows', () => {
	it('counts only what it wrote', async () => {
		const { transaction } = fakeTransaction([row('training-2', { pendingSince: PENDING_SINCE })]);

		await expect(
			absorbRows(transaction, ENTITY, [
				row('training-1'),
				row('training-2'),
				undefined,
				row('training-3'),
			]),
		).resolves.toBe(2);
	});

	it('leaves the one that is waiting and takes the rest', async () => {
		const local = row('training-2', { pendingSince: PENDING_SINCE });
		const { transaction, stored } = fakeTransaction([local]);

		await absorbRows(transaction, ENTITY, [row('training-1'), row('training-2')]);

		expect(stored('training-2')).toBe(local);
		expect(stored('training-1')).toEqual(row('training-1'));
	});

	it('writes nothing for a branch that came down empty', async () => {
		const { transaction, count } = fakeTransaction();

		await expect(absorbRows(transaction, ENTITY, [])).resolves.toBe(0);
		expect(count()).toBe(0);
	});
});
