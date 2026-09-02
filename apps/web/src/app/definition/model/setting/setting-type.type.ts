import { MoveAnimation } from '@app/definition/board-animation.type';
import { MoveInputMethod } from '@app/definition/board-input.type';
import { Language } from '@app/definition/language.type';
import { Gender } from '@app/definition/model/setting/gender.type';
import { IntroProgress } from '@app/definition/model/setting/intro-progress.type';
import { LocalOwner } from '@app/definition/model/setting/local-owner.type';
import { MoveSpeed } from '@app/definition/move-speed.type';
import { Theme } from '@app/definition/service/theme.type';

export interface SettingType {
	THEME: 'THEME';
	PAUSE_AFTER_NEXT_TURN: 'PAUSE_AFTER_NEXT_TURN';
	LANGUAGE: 'LANGUAGE';
	TIMEZONE: 'TIMEZONE';
	GENDER: 'GENDER';
	LAST_SEEN_VERSION: 'LAST_SEEN_VERSION';
	MOVE_ANIMATION: 'MOVE_ANIMATION';
	MOVE_INPUT: 'MOVE_INPUT';
	MOVE_LIFT: 'MOVE_LIFT';
	MOVE_SPEED: 'MOVE_SPEED';
	SOUND: 'SOUND';
	INTRO: 'INTRO';
	BOOKMARK_PROMPT: 'BOOKMARK_PROMPT';
	OWNER: 'OWNER';
}

export interface SettingPayload {
	THEME: Theme | 'system';
	PAUSE_AFTER_NEXT_TURN: boolean;
	LANGUAGE: Language;
	TIMEZONE: string;
	GENDER: Gender;
	LAST_SEEN_VERSION: string;
	MOVE_ANIMATION: MoveAnimation;
	MOVE_INPUT: readonly MoveInputMethod[];
	MOVE_LIFT: boolean;
	MOVE_SPEED: MoveSpeed;
	SOUND: boolean;
	INTRO: IntroProgress;
	BOOKMARK_PROMPT: boolean;
	OWNER: LocalOwner;
}
