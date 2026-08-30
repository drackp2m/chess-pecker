export enum SettingType {
	THEME = 'theme',
	PAUSE_AFTER_NEXT_TURN = 'pause-after-next-turn',
	LANGUAGE = 'language',
	GENDER = 'gender',
	LAST_SEEN_VERSION = 'last-seen-version',
	MOVE_ANIMATION = 'move-animation',
	MOVE_INPUT = 'move-input',
	MOVE_LIFT = 'move-lift',
	MOVE_SPEED = 'move-speed',
	SOUND = 'sound',
	INTRO = 'intro',
	BOOKMARK_PROMPT = 'bookmark-prompt',
	OWNER = 'owner',
}

export type SettingTypeKey = keyof typeof SettingType;
