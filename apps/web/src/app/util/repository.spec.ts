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
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LocalDataRepository } from '@app/repository/local-data.repository';

type Database = typeof IDBDatabase.prototype;

type CreateObjectStore = typeof IDBDatabase.prototype.createObjectStore;

const REAL_CREATE: CreateObjectStore = IDBDatabase.prototype.createObjectStore;

function failCreating(store: string): void {
	IDBDatabase.prototype.createObjectStore = function (
		this: Database,
		name: string,
		options?: IDBObjectStoreParameters,
	): ReturnType<CreateObjectStore> {
		if (store === name) {
			throw new DOMException('the disk is full', 'QuotaExceededError');
		}

		return REAL_CREATE.call(this, name, options);
	};
}

interface Explained {
	readonly message: string;
	readonly cause?: unknown;
}

function isExplained(value: unknown): value is Explained {
	return 'object' === typeof value && null !== value && 'message' in value;
}

function chain(error: unknown): string[] {
	const messages: string[] = [];

	for (let current: unknown = error; isExplained(current); current = current.cause) {
		messages.push(current.message);
	}

	return messages;
}

async function reasonOf(promise: Promise<unknown>): Promise<unknown> {
	return promise.then(
		() => undefined,
		(reason: unknown) => reason,
	);
}

function configure(): LocalDataRepository {
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

	return TestBed.inject(LocalDataRepository);
}

describe('the migrations that open the database', () => {
	let repository: LocalDataRepository;

	beforeEach(() => {
		repository = configure();
	});

	afterEach(() => {
		IDBDatabase.prototype.createObjectStore = REAL_CREATE;
	});

	it('opens when every migration goes through', async () => {
		await expect(repository.findAll('training')).resolves.toEqual([]);
	});

	it('names the migration that blew up, and why', async () => {
		failCreating('setting');

		const failure = await reasonOf(repository.findAll('training'));

		expect(chain(failure)).toEqual([
			'Could not open the `chess-pecker` database',
			'IndexedDB migration v1 failed: create setting store',
			'the disk is full',
		]);
	});

	it('names the migration whatever its place in the queue', async () => {
		failCreating('attemptDraft');

		const failure = await reasonOf(repository.findAll('training'));

		expect(chain(failure)[1]).toContain('IndexedDB migration v15 failed');
	});

	it('does not cache the connection it could not open', async () => {
		failCreating('setting');

		await reasonOf(repository.findAll('training'));

		IDBDatabase.prototype.createObjectStore = REAL_CREATE;

		await expect(repository.findAll('training')).resolves.toEqual([]);
	});
});
