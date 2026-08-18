import { describe, expect, it } from 'vitest';

import { SyncPolicy } from '@app/definition/sync-policy.constant';
import { SyncableRow } from '@app/use-case/sync/local-record';
import { SyncManifestBuilder, syncNode, syncRef } from '@app/use-case/sync/sync-manifest';

const CREATED = new Date('2026-08-11T09:00:00.000Z');
const UPDATED = new Date('2026-08-11T09:30:00.000Z');

function row(over: Partial<SyncableRow> = {}): SyncableRow {
	return { uuid: 'row-1', createdAt: CREATED, updatedAt: UPDATED, ...over };
}

describe('syncRef', () => {
	it('names a row that never travelled by its retry key', () => {
		expect(syncRef(row({ clientRef: 'born-here' }))).toBe('born-here');
	});

	it('falls back to the uuid of a row that has no retry key', () => {
		expect(syncRef(row())).toBe('row-1');
	});

	it('names a row the server already has by its uuid', () => {
		expect(syncRef(row({ clientRef: 'born-here', syncedAt: UPDATED }))).toBe('row-1');
	});
});

describe('syncNode', () => {
	it('hides the local uuid of a row the server does not know', () => {
		expect(syncNode(row({ clientRef: 'born-here' }))).toEqual({
			clientRef: 'born-here',
			createdAt: '2026-08-11T09:00:00.000Z',
			updatedAt: '2026-08-11T09:30:00.000Z',
		});
	});

	it('sends both keys once the row has travelled', () => {
		expect(syncNode(row({ clientRef: 'born-here', syncedAt: UPDATED }))).toMatchObject({
			uuid: 'row-1',
			clientRef: 'born-here',
		});
	});

	it('sends no retry key for a row that came down from the server', () => {
		expect(syncNode(row({ syncedAt: UPDATED }))).not.toHaveProperty('clientRef');
	});
});

describe('SyncManifestBuilder', () => {
	it('confirms nothing until something pending is added', () => {
		const builder = new SyncManifestBuilder();

		expect(builder.pending).toBe(0);
		expect(builder.build().training).toEqual([]);
	});

	it('lists what it takes, by entity', () => {
		const builder = new SyncManifestBuilder();

		builder.add('cycle', row({ uuid: 'cycle-1', pendingSince: UPDATED }));
		builder.add('cycleItem', row({ uuid: 'item-1', pendingSince: UPDATED }));
		builder.add('cycleItem', row({ uuid: 'item-2', pendingSince: UPDATED }));

		expect(builder.pending).toBe(3);
		expect(builder.build()).toMatchObject({
			cycle: ['cycle-1'],
			cycleItem: ['item-1', 'item-2'],
		});
	});

	it('lets a sealed row through without spending budget or being confirmed', () => {
		const builder = new SyncManifestBuilder();

		expect(builder.add('training', row({ syncedAt: UPDATED }))).toBe(true);
		expect(builder.pending).toBe(0);
		expect(builder.build().training).toEqual([]);
	});

	it('refuses the row that does not fit, and only that one', () => {
		const builder = new SyncManifestBuilder();

		for (let index = 0; index < SyncPolicy.pushBatchSize; index += 1) {
			const fitted = builder.add(
				'attempt',
				row({ uuid: `a-${index.toString()}`, pendingSince: UPDATED }),
			);

			expect(fitted).toBe(true);
		}

		expect(builder.add('attempt', row({ uuid: 'over', pendingSince: UPDATED }))).toBe(false);
		expect(builder.add('attempt', row({ uuid: 'sealed', syncedAt: UPDATED }))).toBe(true);
		expect(builder.pending).toBe(SyncPolicy.pushBatchSize);
		expect(builder.build().attempt).not.toContain('over');
	});
});
