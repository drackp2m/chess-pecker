import type { UserSetting } from '@chesspecker/api-definitions';
import { describe, expect, it } from 'vitest';

import { SettingTypeKey } from '@app/definition/model/setting/setting-type.enum';
import { Setting } from '@app/model/setting.model';
import { fromRemote, isPending, mergeSettings } from '@app/util/setting-merge';

const OLD = new Date('2026-08-01T10:00:00.000Z');
const NEW = new Date('2026-08-02T10:00:00.000Z');

function stored(type: SettingTypeKey, payload: unknown, updatedAt: Date, syncedAt?: Date): Setting {
	const setting = new Setting({
		type,
		payload: payload as never,
		...(undefined === syncedAt ? {} : { syncedAt }),
	});

	return Object.assign(setting, { updatedAt });
}

function remote(key: string, value: unknown, updatedAt: Date): UserSetting {
	return {
		uuid: `remote-${key}`,
		key,
		value: { value },
		createdAt: OLD.toISOString(),
		updatedAt: updatedAt.toISOString(),
	};
}

function payloads(settings: readonly Setting[]): Partial<Record<SettingTypeKey, unknown>> {
	return Object.fromEntries(settings.map((setting) => [setting.type, setting.payload]));
}

describe('isPending', () => {
	it('reads a row the account never acknowledged as pending', () => {
		expect(isPending(stored('MOVE_LIFT', false, OLD))).toBe(true);
	});

	it('reads a row acknowledged at its last change as settled', () => {
		expect(isPending(stored('MOVE_LIFT', false, OLD, OLD))).toBe(false);
	});

	it('reads a row changed after the account acknowledged it as pending again', () => {
		const changed = stored('MOVE_LIFT', true, OLD, OLD).with({ payload: false });

		expect(isPending(changed)).toBe(true);
	});
});

describe('fromRemote', () => {
	it('takes the value and the date the account holds, already settled', () => {
		const setting = fromRemote('MOVE_ANIMATION', remote('move-animation', 'always', NEW));

		expect(setting).toBeInstanceOf(Setting);
		expect(setting).toMatchObject({
			type: 'MOVE_ANIMATION',
			payload: 'always',
			updatedAt: NEW,
			syncedAt: NEW,
		});
		expect(isPending(setting)).toBe(false);
	});

	it('keeps the identity of the row it replaces on this device', () => {
		const local = stored('MOVE_ANIMATION', 'first', OLD);

		const setting = fromRemote('MOVE_ANIMATION', remote('move-animation', 'always', NEW), local);

		expect(setting.uuid).toBe(local.uuid);
		expect(setting.createdAt).toBe(local.createdAt);
		expect(local.payload).toBe('first');
	});
});

describe('mergeSettings', () => {
	it('brings back what the account holds to a device that lost its settings', () => {
		const { adopt, push } = mergeSettings(
			[],
			[remote('move-animation', 'always', NEW), remote('move-lift', false, NEW)],
		);

		expect(payloads(adopt)).toStrictEqual({ MOVE_ANIMATION: 'always', MOVE_LIFT: false });
		expect(adopt.every((setting) => !isPending(setting))).toBe(true);
		expect(push).toStrictEqual([]);
	});

	it('uploads what this device chose and the account never heard of', () => {
		const animation = stored('MOVE_ANIMATION', 'always', OLD);
		const lift = stored('MOVE_LIFT', false, OLD);

		const { adopt, push } = mergeSettings([animation, lift], []);

		expect(adopt).toStrictEqual([]);
		expect(push).toStrictEqual([animation, lift]);
	});

	it('uploads a settled row the account does not hold, as on an account it never reached', () => {
		const lift = stored('MOVE_LIFT', false, OLD, OLD);

		expect(mergeSettings([lift], []).push).toStrictEqual([lift]);
	});

	it('uploads a change made on this device after the one the account holds', () => {
		const lift = stored('MOVE_LIFT', false, NEW);

		const { adopt, push } = mergeSettings([lift], [remote('move-lift', true, OLD)]);

		expect(adopt).toStrictEqual([]);
		expect(push).toStrictEqual([lift]);
	});

	it('takes the account value when it changed after the one waiting on this device', () => {
		const lift = stored('MOVE_LIFT', true, OLD);

		const { adopt, push } = mergeSettings([lift], [remote('move-lift', false, NEW)]);

		expect(payloads(adopt)).toStrictEqual({ MOVE_LIFT: false });
		expect(push).toStrictEqual([]);
	});

	it('takes the account value over a settled row another device has since changed', () => {
		const animation = stored('MOVE_ANIMATION', 'first', OLD, OLD);

		const { adopt } = mergeSettings([animation], [remote('move-animation', 'always', NEW)]);

		expect(payloads(adopt)).toStrictEqual({ MOVE_ANIMATION: 'always' });
	});

	it('takes the account value over a settled row even when that row is newer', () => {
		const animation = stored('MOVE_ANIMATION', 'never', NEW, NEW);

		const { adopt, push } = mergeSettings([animation], [remote('move-animation', 'always', OLD)]);

		expect(payloads(adopt)).toStrictEqual({ MOVE_ANIMATION: 'always' });
		expect(push).toStrictEqual([]);
	});

	it('leaves alone a row already settled with what the account holds', () => {
		const animation = stored('MOVE_ANIMATION', 'always', NEW, NEW);

		expect(mergeSettings([animation], [remote('move-animation', 'always', NEW)])).toStrictEqual({
			adopt: [],
			push: [],
		});
	});

	it('neither uploads nor takes the settings that belong to the device', () => {
		const owner = stored('OWNER', { uuid: 'user', username: 'drackp2m' }, NEW);
		const version = stored('LAST_SEEN_VERSION', '1.0.0', NEW);
		const intro = stored('INTRO', { step: 2, isCompleted: false }, NEW);

		const { adopt, push } = mergeSettings(
			[owner, version, intro],
			[
				remote('owner', { uuid: 'other', username: 'other' }, OLD),
				remote('last-seen-version', '0.9.0', OLD),
				remote('intro', { step: 0, isCompleted: true }, OLD),
			],
		);

		expect(adopt).toStrictEqual([]);
		expect(push).toStrictEqual([]);
	});

	it('ignores keys the account holds that this version does not know', () => {
		expect(mergeSettings([], [remote('board-colour', 'green', NEW)]).adopt).toStrictEqual([]);
	});
});
