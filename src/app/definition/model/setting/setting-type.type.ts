import { Theme } from '@app/definition/service/theme.type';

export interface SettingType {
	THEME: 'THEME';
	PAUSE_AFTER_NEXT_TURN: 'PAUSE_AFTER_NEXT_TURN';
	LAST_SEEN_VERSION: 'LAST_SEEN_VERSION';
}

export interface SettingPayload {
	THEME: Theme | 'system';
	PAUSE_AFTER_NEXT_TURN: boolean;
	LAST_SEEN_VERSION: string;
}
