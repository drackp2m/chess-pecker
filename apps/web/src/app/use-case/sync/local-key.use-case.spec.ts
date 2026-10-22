import { TestBed } from '@angular/core/testing';
import {
	IDBCursor,
	IDBDatabase,
	IDBFactory,
	IDBIndex,
	IDBKeyRange,
	IDBObjectStore,
	IDBRequest,
	IDBTransaction,
} from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';

import { TrainingRow } from '@app/repository/definition/training-schema.interface';
import { LocalDataRepository } from '@app/repository/local-data.repository';
import { LocalKeyUseCase } from '@app/use-case/sync/local-key.use-case';
import { born, confirmed } from '@app/use-case/sync/local-record';

const CREATED = new Date('2026-08-01T09:00:00.000Z');

const SYNCED = new Date('2026-08-18T09:30:00.000Z');

function training(uuid: string): TrainingRow {
	return { uuid, status: 'running', createdAt: CREATED, updatedAt: CREATED };
}

function configure() {
	Object.assign(globalThis, {
		indexedDB: new IDBFactory(),
		IDBCursor,
		IDBDatabase,
		IDBIndex,
		IDBKeyRange,
		IDBObjectStore,
		IDBRequest,
		IDBTransaction,
	});

	TestBed.resetTestingModule();
	TestBed.configureTestingModule({});

	return {
		repository: TestBed.inject(LocalDataRepository),
		keys: TestBed.inject(LocalKeyUseCase),
	};
}

describe('LocalKeyUseCase', () => {
	let repository: LocalDataRepository;
	let keys: LocalKeyUseCase;

	beforeEach(() => {
		({ repository, keys } = configure());
	});

	it('resolves a current key to itself', async () => {
		await repository.insert('training', born(training('training-1')));

		await expect(keys.current('training', 'training-1')).resolves.toBe('training-1');
	});

	it('resolves the uuid a row was born with after it was rekeyed', async () => {
		await repository.insert(
			'training',
			confirmed({ ...born(training('training-1')), uuid: 'server-training-1' }, SYNCED),
		);

		await expect(keys.current('training', 'training-1')).resolves.toBe('server-training-1');
	});

	it('resolves a downloaded row, which has no clientRef, by its own uuid', async () => {
		await repository.insert('training', confirmed(training('server-training-1'), SYNCED));

		await expect(keys.current('training', 'server-training-1')).resolves.toBe('server-training-1');
	});

	it('leaves alone a key nobody holds', async () => {
		await repository.insert('training', born(training('training-1')));

		await expect(keys.current('training', 'nobody')).resolves.toBe('nobody');
	});
});
