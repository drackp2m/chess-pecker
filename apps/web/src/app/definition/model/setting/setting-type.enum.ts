export enum SettingType {
	THEME = 'theme',
	PAUSE_AFTER_NEXT_TURN = 'pause-after-next-turn',
	LANGUAGE = 'language',
	LAST_SEEN_VERSION = 'last-seen-version',
	MOVE_ANIMATION = 'move-animation',
	MOVE_INPUT = 'move-input',
	MOVE_SPEED = 'move-speed',
	SOUND = 'sound',
}

export type SettingTypeKey = keyof typeof SettingType;
