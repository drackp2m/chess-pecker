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

import { Setting } from '@app/model/setting.model';
import { SettingRepository } from '@app/repository/setting.repository';

const OLD = new Date('2026-08-01T10:00:00.000Z');
const MID = new Date('2026-08-02T10:00:00.000Z');
const NEW = new Date('2026-08-03T10:00:00.000Z');

function configure(): SettingRepository {
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
	TestBed.configureTestingModule({ providers: [SettingRepository] });

	return TestBed.inject(SettingRepository);
}

function lift(isEnabled: boolean, updatedAt: Date, syncedAt?: Date): Setting {
	const setting = new Setting({
		type: 'MOVE_LIFT',
		payload: isEnabled,
		...(undefined === syncedAt ? {} : { syncedAt }),
	});

	return Object.assign(setting, { updatedAt });
}

describe('SettingRepository', () => {
	let repository: SettingRepository;

	beforeEach(() => {
		repository = configure();
	});

	it('reads back the date the account acknowledged a row at', async () => {
		await repository.insert('setting', lift(false, NEW, NEW));

		const found = await repository.find('setting', 'MOVE_LIFT');

		expect(found).toBeInstanceOf(Setting);
		expect(found?.syncedAt).toStrictEqual(NEW);
	});

	describe('replace', () => {
		it('writes over the row it was told to expect', async () => {
			const read = lift(true, OLD);
			const next = lift(false, NEW, NEW);

			await repository.insert('setting', read);

			await expect(repository.replace(read, next)).resolves.toBe(next);
			expect(await repository.find('setting', 'MOVE_LIFT')).toMatchObject({
				payload: false,
				syncedAt: NEW,
			});
		});

		it('writes a row where none was expected and none is stored', async () => {
			const next = lift(false, NEW, NEW);

			await expect(repository.replace(undefined, next)).resolves.toBe(next);
			expect((await repository.find('setting', 'MOVE_LIFT'))?.payload).toBe(false);
		});

		it('leaves alone a row changed since it was read', async () => {
			const read = lift(true, OLD);

			await repository.insert('setting', read);
			await repository.insert('setting', lift(false, NEW));

			await expect(repository.replace(read, lift(true, MID, MID))).resolves.toBeNull();
			expect(await repository.find('setting', 'MOVE_LIFT')).toMatchObject({
				payload: false,
				updatedAt: NEW,
			});
		});

		it('leaves alone a row stored since nothing was read', async () => {
			await repository.insert('setting', lift(false, NEW));

			await expect(repository.replace(undefined, lift(true, MID, MID))).resolves.toBeNull();
			expect((await repository.find('setting', 'MOVE_LIFT'))?.payload).toBe(false);
		});
	});
});
