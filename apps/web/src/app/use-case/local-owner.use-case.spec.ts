import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { AuthUser } from '@chesspecker/api-definitions';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SettingTypeKey } from '@app/definition/model/setting/setting-type.enum';
import { Setting } from '@app/model/setting.model';
import { SettingRepository } from '@app/repository/setting.repository';
import { SessionStore } from '@app/store/session.store';
import { LocalOwnerUseCase } from '@app/use-case/local-owner.use-case';

const ada: AuthUser = { uuid: 'uuid-ada', username: 'ada', role: 'registered' };

const bob: AuthUser = { uuid: 'uuid-bob', username: 'bob', role: 'registered' };

async function settle(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

function configure(writeFails = false) {
	const rows = new Map<SettingTypeKey, Setting>();
	const repository = {
		find: vi.fn((_store: string, key: SettingTypeKey) => Promise.resolve(rows.get(key))),
		insert: vi.fn((_store: string, row: Setting) => {
			if (writeFails) {
				return Promise.reject(new Error('quota exceeded'));
			}

			rows.set(row.type, row);

			return Promise.resolve(row);
		}),
		delete: vi.fn((_store: string, key: SettingTypeKey) => {
			rows.delete(key);

			return Promise.resolve();
		}),
	};
	const user: WritableSignal<AuthUser | null> = signal(null);

	TestBed.configureTestingModule({
		providers: [
			{ provide: SettingRepository, useValue: repository },
			{ provide: SessionStore, useValue: { user } },
		],
	});

	return { repository, rows, user, owner: TestBed.inject(LocalOwnerUseCase) };
}

describe('LocalOwnerUseCase', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
		vi.restoreAllMocks();
	});

	it('remembers the account this device belongs to and forgets it on release', async () => {
		const { owner } = configure();

		await owner.claim(ada);

		expect(await owner.read()).toEqual({ uuid: 'uuid-ada', username: 'ada' });

		await owner.release();

		expect(await owner.read()).toBeUndefined();
	});

	it('reads nothing on a device nobody has claimed', async () => {
		const { owner } = configure();

		expect(await owner.read()).toBeUndefined();
	});

	it('rewrites the stamp in place when another account takes the device over', async () => {
		const { owner, rows, repository } = configure();

		await owner.claim(ada);

		const first = repository.insert.mock.calls[0]?.[1];

		await owner.claim(bob);

		const second = repository.insert.mock.calls[1]?.[1];

		expect(rows.size).toBe(1);
		expect(second?.uuid).toBe(first?.uuid);
		expect(await owner.read()).toEqual({ uuid: 'uuid-bob', username: 'bob' });
	});

	it('stamps the device for whoever the boot probe finds already logged in', async () => {
		const { owner, user } = configure();

		TestBed.tick();
		await settle();

		expect(await owner.read()).toBeUndefined();

		user.set(ada);
		TestBed.tick();
		await settle();

		expect(await owner.read()).toEqual({ uuid: 'uuid-ada', username: 'ada' });
	});

	it('swallows a write that fails so the boot probe still finishes', async () => {
		const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const { user } = configure(true);

		user.set(ada);
		TestBed.tick();
		await settle();

		expect(logged).toHaveBeenCalled();
	});
});
