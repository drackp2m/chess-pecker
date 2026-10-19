import type { UserSetting } from '@chesspecker/api-definitions';

import {
	ACCOUNT_SETTINGS,
	toRemoteKey,
} from '@app/definition/model/setting/setting-scope.constant';
import { SettingTypeKey } from '@app/definition/model/setting/setting-type.enum';
import { SettingPayload } from '@app/definition/model/setting/setting-type.type';
import { Setting } from '@app/model/setting.model';

export interface SettingMerge {
	readonly adopt: readonly Setting[];
	readonly push: readonly Setting[];
}

export function isPending(setting: Setting): boolean {
	return undefined === setting.syncedAt || setting.syncedAt.getTime() < setting.updatedAt.getTime();
}

export function fromRemote(type: SettingTypeKey, remote: UserSetting, local?: Setting): Setting {
	const updatedAt = new Date(remote.updatedAt);
	const payload = remote.value.value as SettingPayload[SettingTypeKey];

	return Object.assign(local?.with({ payload }) ?? new Setting({ type, payload }), {
		updatedAt,
		syncedAt: updatedAt,
	});
}

export function mergeSettings(
	local: readonly Setting[],
	remote: readonly UserSetting[],
): SettingMerge {
	const adopt: Setting[] = [];
	const push: Setting[] = [];

	for (const type of ACCOUNT_SETTINGS) {
		const mine = local.find((setting) => type === setting.type);
		const theirs = remote.find((setting) => toRemoteKey(type) === setting.key);

		if (undefined === theirs) {
			if (undefined !== mine) {
				push.push(mine);
			}

			continue;
		}

		if (undefined !== mine && isNewer(mine, theirs)) {
			push.push(mine);
		} else if (undefined === mine || !isSyncedWith(mine, theirs)) {
			adopt.push(fromRemote(type, theirs, mine));
		}
	}

	return { adopt, push };
}

function isNewer(local: Setting, remote: UserSetting): boolean {
	return isPending(local) && local.updatedAt.getTime() > new Date(remote.updatedAt).getTime();
}

function isSyncedWith(local: Setting, remote: UserSetting): boolean {
	return !isPending(local) && local.updatedAt.getTime() === new Date(remote.updatedAt).getTime();
}
