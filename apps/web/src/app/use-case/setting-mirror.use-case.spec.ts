import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { UserSetting } from '@chesspecker/api-definitions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingTypeKey } from '@app/definition/model/setting/setting-type.enum';
import { Setting } from '@app/model/setting.model';
import { SettingRepository } from '@app/repository/setting.repository';
import { UserSettingRepository } from '@app/repository/user-setting.repository';
import { SessionStore } from '@app/store/session.store';
import { SettingMirrorUseCase } from '@app/use-case/setting-mirror.use-case';
import { isPending } from '@app/util/setting-merge';

const OLD = new Date('2026-08-01T10:00:00.000Z');
const NEW = new Date('2026-08-02T10:00:00.000Z');
const LATER = new Date('2026-08-03T10:00:00.000Z');

interface Options {
	readonly rows?: readonly Setting[];
	readonly remote?: readonly UserSetting[];
	readonly authenticated?: boolean;
}

function stored(type: SettingTypeKey, payload: unknown, updatedAt: Date, syncedAt?: Date): Setting {
	const setting = new Setting({
		type,
		payload: payload as never,
		...(undefined === syncedAt ? {} : { syncedAt }),
	});

	return Object.assign(setting, { updatedAt });
}

function remoteSetting(key: string, value: unknown, updatedAt: Date): UserSetting {
	return {
		uuid: `remote-${key}`,
		key,
		value: { value },
		createdAt: OLD.toISOString(),
		updatedAt: updatedAt.toISOString(),
	};
}

function configure(options: Options = {}) {
	const rows = new Map((options.rows ?? []).map((row) => [row.type, row]));
	const local = {
		findAll: vi.fn(() => Promise.resolve([...rows.values()])),
		replace: vi.fn((expected: Setting | undefined, next: Setting) => {
			if (rows.get(next.type)?.updatedAt.getTime() !== expected?.updatedAt.getTime()) {
				return Promise.resolve(null);
			}

			rows.set(next.type, next);

			return Promise.resolve(next);
		}),
	};
	const remote = {
		list: vi.fn(() => Promise.resolve(options.remote ?? [])),
		upsert: vi.fn((key: string, value: unknown, updatedAt: Date): Promise<UserSetting> =>
			Promise.resolve(remoteSetting(key, value, updatedAt)),
		),
	};
	const isAuthenticated = signal(options.authenticated ?? true);

	TestBed.configureTestingModule({
		providers: [
			{ provide: SettingRepository, useValue: local },
			{ provide: UserSettingRepository, useValue: remote },
			{ provide: SessionStore, useValue: { isAuthenticated } },
		],
	});

	return { rows, local, remote, mirror: TestBed.inject(SettingMirrorUseCase) };
}

describe('SettingMirrorUseCase', () => {
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		TestBed.resetTestingModule();
		vi.restoreAllMocks();
	});

	describe('pull', () => {
		it('brings the account settings back to a device that lost them', async () => {
			const { rows, remote, mirror } = configure({
				remote: [
					remoteSetting('move-animation', 'always', NEW),
					remoteSetting('move-lift', false, NEW),
				],
			});

			const pulled = await mirror.pull();

			expect(pulled.isChanged).toBe(true);
			expect(rows.get('MOVE_ANIMATION')).toMatchObject({ payload: 'always', syncedAt: NEW });
			expect(rows.get('MOVE_LIFT')).toMatchObject({ payload: false, syncedAt: NEW });
			expect(pulled.rows.map((row) => row.type)).toStrictEqual(['MOVE_ANIMATION', 'MOVE_LIFT']);
			expect(remote.upsert).not.toHaveBeenCalled();
		});

		it('uploads what the device chose before the account held anything', async () => {
			const { rows, remote, mirror } = configure({
				rows: [stored('MOVE_ANIMATION', 'always', OLD), stored('MOVE_LIFT', false, OLD)],
			});

			const pulled = await mirror.pull();

			expect(pulled.isChanged).toBe(false);
			expect(remote.upsert).toHaveBeenCalledWith('move-animation', 'always', OLD);
			expect(remote.upsert).toHaveBeenCalledWith('move-lift', false, OLD);
			expect([...rows.values()].some(isPending)).toBe(false);
		});

		it('keeps a change the device made after the one the account holds', async () => {
			const { rows, remote, mirror } = configure({
				rows: [stored('MOVE_LIFT', false, NEW)],
				remote: [remoteSetting('move-lift', true, OLD)],
			});

			await mirror.pull();

			expect(remote.upsert).toHaveBeenCalledWith('move-lift', false, NEW);
			expect(rows.get('MOVE_LIFT')).toMatchObject({ payload: false, syncedAt: NEW });
		});

		it('reports a change when the account answers an upload with a newer value', async () => {
			const { rows, remote, mirror } = configure({
				rows: [stored('MOVE_LIFT', false, OLD)],
			});

			remote.upsert.mockResolvedValueOnce(remoteSetting('move-lift', true, LATER));

			const pulled = await mirror.pull();

			expect(pulled.isChanged).toBe(true);
			expect(rows.get('MOVE_LIFT')).toMatchObject({ payload: true, syncedAt: LATER });
		});

		it('reports nothing when the device already holds what the account does', async () => {
			const { remote, mirror } = configure({
				rows: [stored('MOVE_LIFT', false, NEW, NEW)],
				remote: [remoteSetting('move-lift', false, NEW)],
			});

			const pulled = await mirror.pull();

			expect(pulled.isChanged).toBe(false);
			expect(remote.upsert).not.toHaveBeenCalled();
		});

		it('does not overwrite a choice made on the device while the account was read', async () => {
			const { rows, local, mirror } = configure({
				rows: [stored('MOVE_LIFT', true, OLD, OLD)],
				remote: [remoteSetting('move-lift', true, NEW)],
			});
			const choice = stored('MOVE_LIFT', false, LATER);

			local.findAll.mockImplementationOnce(() => {
				const read = [...rows.values()];

				rows.set('MOVE_LIFT', choice);

				return Promise.resolve(read);
			});

			const pulled = await mirror.pull();

			expect(pulled.isChanged).toBe(false);
			expect(rows.get('MOVE_LIFT')).toBe(choice);
		});

		it('lets the failure of the account read reach the caller', async () => {
			const { remote, local, mirror } = configure();

			remote.list.mockRejectedValueOnce(new Error('offline'));

			await expect(mirror.pull()).rejects.toThrow('offline');
			expect(local.replace).not.toHaveBeenCalled();
		});
	});

	describe('push', () => {
		it('uploads the change and settles the row with what the account answered', async () => {
			const lift = stored('MOVE_LIFT', false, NEW);
			const { rows, remote, mirror } = configure({ rows: [lift] });

			const settled = await mirror.push(lift);

			expect(remote.upsert).toHaveBeenCalledWith('move-lift', false, NEW);
			expect(settled).toMatchObject({ uuid: lift.uuid, payload: false, syncedAt: NEW });
			expect(rows.get('MOVE_LIFT')).toBe(settled);
		});

		it('takes the value the account kept when it was newer than the upload', async () => {
			const lift = stored('MOVE_LIFT', false, OLD);
			const { remote, mirror } = configure({ rows: [lift] });

			remote.upsert.mockResolvedValueOnce(remoteSetting('move-lift', true, NEW));

			expect(await mirror.push(lift)).toMatchObject({ payload: true, updatedAt: NEW });
		});

		it('uploads nothing without a session, leaving the row pending', async () => {
			const lift = stored('MOVE_LIFT', false, NEW);
			const { rows, remote, mirror } = configure({ rows: [lift], authenticated: false });

			expect(await mirror.push(lift)).toBeNull();
			expect(remote.upsert).not.toHaveBeenCalled();
			expect(isPending(rows.get('MOVE_LIFT') ?? lift)).toBe(true);
		});

		it('uploads nothing that belongs to the device', async () => {
			const version = stored('LAST_SEEN_VERSION', '1.0.0', NEW);
			const { remote, mirror } = configure({ rows: [version] });

			expect(await mirror.push(version)).toBeNull();
			expect(remote.upsert).not.toHaveBeenCalled();
		});

		it('keeps the row pending when the trip fails', async () => {
			const lift = stored('MOVE_LIFT', false, NEW);
			const { rows, remote, mirror } = configure({ rows: [lift] });

			remote.upsert.mockRejectedValueOnce(new Error('offline'));

			expect(await mirror.push(lift)).toBeNull();
			expect(rows.get('MOVE_LIFT')).toBe(lift);
		});

		it('does not settle a row changed again while it was on its way up', async () => {
			const lift = stored('MOVE_LIFT', false, NEW);
			const again = stored('MOVE_LIFT', true, LATER);
			const { rows, remote, mirror } = configure({ rows: [lift] });

			remote.upsert.mockImplementationOnce((key, value, updatedAt) => {
				rows.set('MOVE_LIFT', again);

				return Promise.resolve(remoteSetting(key, value, updatedAt));
			});

			expect(await mirror.push(lift)).toBeNull();
			expect(rows.get('MOVE_LIFT')).toBe(again);
		});
	});

	describe('pushPending', () => {
		it('uploads only the rows the account has not acknowledged', async () => {
			const { remote, mirror } = configure({
				rows: [
					stored('MOVE_ANIMATION', 'always', NEW),
					stored('MOVE_LIFT', false, OLD, OLD),
					stored('SOUND', false, NEW, OLD),
				],
			});

			await mirror.pushPending();

			expect(remote.upsert).toHaveBeenCalledTimes(2);
			expect(remote.upsert).toHaveBeenCalledWith('move-animation', 'always', NEW);
			expect(remote.upsert).toHaveBeenCalledWith('sound', false, NEW);
		});
	});
});
