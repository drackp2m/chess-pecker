export enum SettingType {
	THEME = 'theme',
	PAUSE_AFTER_NEXT_TURN = 'pause-after-next-turn',
	LAST_SEEN_VERSION = 'last-seen-version',
}

export type SettingTypeKey = keyof typeof SettingType;
