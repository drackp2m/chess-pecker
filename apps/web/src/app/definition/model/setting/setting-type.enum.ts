export enum SettingType {
	THEME = 'theme',
	PAUSE_AFTER_NEXT_TURN = 'pause-after-next-turn',
	LAST_SEEN_VERSION = 'last-seen-version',
	MOVE_ANIMATION = 'move-animation',
	MOVE_INPUT = 'move-input',
}

export type SettingTypeKey = keyof typeof SettingType;
