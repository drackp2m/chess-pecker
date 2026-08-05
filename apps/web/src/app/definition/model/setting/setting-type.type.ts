import { MoveAnimation } from '@app/definition/board-animation.type';
import { MoveInputMethod } from '@app/definition/board-input.type';
import { MoveSpeed } from '@app/definition/move-speed.type';
import { Theme } from '@app/definition/service/theme.type';

export interface SettingType {
	THEME: 'THEME';
	PAUSE_AFTER_NEXT_TURN: 'PAUSE_AFTER_NEXT_TURN';
	LAST_SEEN_VERSION: 'LAST_SEEN_VERSION';
	MOVE_ANIMATION: 'MOVE_ANIMATION';
	MOVE_INPUT: 'MOVE_INPUT';
	MOVE_SPEED: 'MOVE_SPEED';
	SOUND: 'SOUND';
}

export interface SettingPayload {
	THEME: Theme | 'system';
	PAUSE_AFTER_NEXT_TURN: boolean;
	LAST_SEEN_VERSION: string;
	MOVE_ANIMATION: MoveAnimation;
	MOVE_INPUT: readonly MoveInputMethod[];
	MOVE_SPEED: MoveSpeed;
	SOUND: boolean;
}
