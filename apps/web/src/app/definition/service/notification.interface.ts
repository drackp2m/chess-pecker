export interface NotificationAction {
	label: string;
	callback: () => void;
}

export interface AppNotification {
	uuid: string;
	message: string;
	duration: number | null;
	leaving: boolean;
	action?: NotificationAction;
}
