import { MoveAnimation } from '@app/definition/board-animation.type';
import { MoveInputMethod } from '@app/definition/board-input.type';
import { Language } from '@app/definition/language.type';
import { IntroProgress } from '@app/definition/model/setting/intro-progress.type';
import { LocalOwner } from '@app/definition/model/setting/local-owner.type';
import { MoveSpeed } from '@app/definition/move-speed.type';
import { Theme } from '@app/definition/service/theme.type';

export interface SettingType {
	THEME: 'THEME';
	PAUSE_AFTER_NEXT_TURN: 'PAUSE_AFTER_NEXT_TURN';
	LANGUAGE: 'LANGUAGE';
	LAST_SEEN_VERSION: 'LAST_SEEN_VERSION';
	MOVE_ANIMATION: 'MOVE_ANIMATION';
	MOVE_INPUT: 'MOVE_INPUT';
	MOVE_SPEED: 'MOVE_SPEED';
	SOUND: 'SOUND';
	INTRO: 'INTRO';
	OWNER: 'OWNER';
}

export interface SettingPayload {
	THEME: Theme | 'system';
	PAUSE_AFTER_NEXT_TURN: boolean;
	LANGUAGE: Language;
	LAST_SEEN_VERSION: string;
	MOVE_ANIMATION: MoveAnimation;
	MOVE_INPUT: readonly MoveInputMethod[];
	MOVE_SPEED: MoveSpeed;
	SOUND: boolean;
	INTRO: IntroProgress;
	OWNER: LocalOwner;
}
