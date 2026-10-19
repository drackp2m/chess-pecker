import { SettingType, SettingTypeKey } from '@app/definition/model/setting/setting-type.enum';

export type SettingScope = 'account' | 'device';

export const SETTING_SCOPE: Readonly<Record<SettingTypeKey, SettingScope>> = {
	THEME: 'account',
	PAUSE_AFTER_NEXT_TURN: 'account',
	LANGUAGE: 'account',
	TIMEZONE: 'account',
	GENDER: 'account',
	LAST_SEEN_VERSION: 'device',
	MOVE_ANIMATION: 'account',
	MOVE_INPUT: 'account',
	MOVE_LIFT: 'account',
	MOVE_SPEED: 'account',
	SOUND: 'account',
	INTRO: 'device',
	BOOKMARK_PROMPT: 'account',
	OWNER: 'device',
	ANALYSIS_BAR: 'account',
	ANALYSIS_DEPTH: 'account',
};

export const ACCOUNT_SETTINGS: readonly SettingTypeKey[] = (
	Object.keys(SETTING_SCOPE) as SettingTypeKey[]
).filter((type) => 'account' === SETTING_SCOPE[type]);

export function isAccountSetting(type: SettingTypeKey): boolean {
	return 'account' === SETTING_SCOPE[type];
}

export function toRemoteKey(type: SettingTypeKey): string {
	return SettingType[type];
}
