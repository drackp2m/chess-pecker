import type { TranslationRef } from '@app/definition/i18n.type';

export interface NotificationAction {
	label: TranslationRef;
	callback: () => void;
}

export interface AppNotification {
	uuid: string;
	message: TranslationRef;
	duration: number | null;
	leaving: boolean;
	action?: NotificationAction;
}
