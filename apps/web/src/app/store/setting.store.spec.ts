import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingTypeKey } from '@app/definition/model/setting/setting-type.enum';
import { Setting } from '@app/model/setting.model';
import { SettingRepository } from '@app/repository/setting.repository';
import { NotificationService } from '@app/service/notification.service';
import { SessionStore } from '@app/store/session.store';
import { SettingStore } from '@app/store/setting.store';
import { SettingMirrorUseCase, SettingPull } from '@app/use-case/setting-mirror.use-case';

const OLD = new Date('2026-08-01T10:00:00.000Z');
const NEW = new Date('2026-08-02T10:00:00.000Z');

interface Options {
	readonly load?: () => Promise<Setting[]>;
	readonly pull?: () => Promise<SettingPull>;
	readonly authenticated?: boolean;
}

function stored(type: SettingTypeKey, payload: unknown, updatedAt: Date): Setting {
	return Object.assign(new Setting({ type, payload: payload as never }), { updatedAt });
}

function deferred<T>() {
	let resolve: (value: T) => void = () => undefined;
	const promise = new Promise<T>((settle) => {
		resolve = settle;
	});

	return { promise, resolve };
}

async function flush(): Promise<void> {
	for (let index = 0; 20 > index; index++) {
		TestBed.tick();
		await Promise.resolve();
	}
}

function configure(options: Options = {}) {
	const repository = {
		isUpgradeBlocked: signal(false),
		findAll: vi.fn(() => options.load?.() ?? Promise.resolve([])),
		insert: vi.fn((_store: string, item: Setting) => Promise.resolve(item)),
	};
	const mirror = {
		pull: vi.fn(() => options.pull?.() ?? Promise.resolve({ rows: [], isChanged: false })),
		push: vi.fn((_setting: Setting): Promise<Setting | null> => Promise.resolve(null)),
	};
	const notifications = { notify: vi.fn(() => 'notification'), dismiss: vi.fn() };
	const isAuthenticated = signal(options.authenticated ?? false);

	TestBed.configureTestingModule({
		providers: [
			{ provide: SettingRepository, useValue: repository },
			{ provide: SettingMirrorUseCase, useValue: mirror },
			{ provide: SessionStore, useValue: { isAuthenticated } },
			{ provide: NotificationService, useValue: notifications },
		],
	});

	return {
		repository,
		mirror,
		notifications,
		session: isAuthenticated,
		store: TestBed.inject(SettingStore),
	};
}

function payloadOf(settings: readonly Setting[] | null, type: SettingTypeKey): unknown {
	return settings?.find((setting) => type === setting.type)?.payload;
}

describe('SettingStore', () => {
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		TestBed.resetTestingModule();
		vi.restoreAllMocks();
	});

	describe('loading from the device', () => {
		it('hands nothing to the readers until the device rows are read', () => {
			const { store } = configure({ load: () => deferred<Setting[]>().promise });

			expect(store.arrived()).toBeNull();
			expect(store.isLoading()).toBe(true);
		});

		it('hands the device rows to the readers once they are read', async () => {
			const rows = [stored('MOVE_ANIMATION', 'always', OLD), stored('MOVE_LIFT', false, OLD)];
			const { store } = configure({ load: () => Promise.resolve(rows) });

			await flush();

			expect(store.arrived()).toStrictEqual(rows);
			expect(store.settingEntities()).toStrictEqual(rows);
			expect(store.isLoading()).toBe(false);
		});

		it('hands the readers an empty list when the device rows cannot be read', async () => {
			const { store, notifications } = configure({
				load: () => Promise.reject(new Error('the database is closed')),
			});

			await flush();

			expect(store.arrived()).toStrictEqual([]);
			expect(store.isLoading()).toBe(false);
			expect(notifications.notify).toHaveBeenCalledTimes(1);
		});
	});

	describe('mirroring the account', () => {
		it('hands the readers the account settings when a session opens', async () => {
			const pulled = [stored('MOVE_ANIMATION', 'always', NEW), stored('MOVE_LIFT', false, NEW)];
			const { store, mirror, session } = configure({
				pull: () => Promise.resolve({ rows: pulled, isChanged: true }),
			});

			await flush();

			expect(store.arrived()).toStrictEqual([]);
			expect(mirror.pull).not.toHaveBeenCalled();

			session.set(true);
			await flush();

			expect(mirror.pull).toHaveBeenCalledTimes(1);
			expect(payloadOf(store.arrived(), 'MOVE_ANIMATION')).toBe('always');
			expect(payloadOf(store.arrived(), 'MOVE_LIFT')).toBe(false);
			expect(store.settingEntities()).toStrictEqual(pulled);
		});

		it('mirrors again when the session comes back after it expired', async () => {
			const { mirror, session } = configure({ authenticated: true });

			await flush();

			session.set(false);
			await flush();

			session.set(true);
			await flush();

			expect(mirror.pull).toHaveBeenCalledTimes(2);
		});

		it('mirrors only once for as long as the same session lasts', async () => {
			const { mirror } = configure({ authenticated: true });

			await flush();
			await flush();

			expect(mirror.pull).toHaveBeenCalledTimes(1);
		});

		it('waits for the device rows before mirroring', async () => {
			const load = deferred<Setting[]>();
			const { mirror } = configure({ load: () => load.promise, authenticated: true });

			await flush();

			expect(mirror.pull).not.toHaveBeenCalled();

			load.resolve([]);
			await flush();

			expect(mirror.pull).toHaveBeenCalledTimes(1);
		});

		it('leaves the readers alone when the account changed nothing here', async () => {
			const rows = [stored('MOVE_LIFT', false, OLD)];
			const { store } = configure({
				load: () => Promise.resolve(rows),
				pull: () => Promise.resolve({ rows: [stored('MOVE_LIFT', false, OLD)], isChanged: false }),
				authenticated: true,
			});

			await flush();

			expect(store.arrived()).toBe(rows);
		});

		it('keeps the device settings when the account cannot be read', async () => {
			const rows = [stored('MOVE_LIFT', false, OLD)];
			const { store, mirror } = configure({
				load: () => Promise.resolve(rows),
				pull: () => Promise.reject(new Error('offline')),
				authenticated: true,
			});

			await flush();

			expect(mirror.pull).toHaveBeenCalledTimes(1);
			expect(store.arrived()).toBe(rows);
			expect(store.settingEntities()).toStrictEqual(rows);
		});
	});

	describe('save', () => {
		it('stores the change on the device and uploads it', async () => {
			const { store, repository, mirror } = configure({ authenticated: true });
			const lift = stored('MOVE_LIFT', false, NEW);

			await flush();
			store.save(lift);
			await flush();

			expect(repository.insert).toHaveBeenCalledWith('setting', lift);
			expect(mirror.push).toHaveBeenCalledWith(lift);
			expect(store.settingEntities()).toStrictEqual([lift]);
		});

		it('does not hand the readers their own change back', async () => {
			const { store, mirror } = configure();
			const lift = stored('MOVE_LIFT', false, NEW);

			await flush();

			const settled = Object.assign(stored('MOVE_LIFT', false, NEW), { syncedAt: NEW });
			const before = store.arrived();

			mirror.push.mockResolvedValueOnce(settled);
			store.save(lift);
			await flush();

			expect(store.arrived()).toBe(before);
		});

		it('hands the readers the value the account kept when it was newer', async () => {
			const { store, mirror } = configure({ authenticated: true });
			const lift = stored('MOVE_LIFT', false, OLD);
			const kept = stored('MOVE_LIFT', true, NEW);

			mirror.push.mockResolvedValueOnce(kept);

			await flush();
			store.save(lift);
			await flush();

			expect(payloadOf(store.arrived(), 'MOVE_LIFT')).toBe(true);
			expect(store.settingEntities()).toStrictEqual([kept]);
		});
	});
});
