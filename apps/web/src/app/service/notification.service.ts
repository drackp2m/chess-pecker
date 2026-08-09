import { Injectable, inject, signal } from '@angular/core';

import type { TranslationRef } from '@app/definition/i18n.type';
import {
	AppNotification,
	NotificationAction,
} from '@app/definition/service/notification.interface';
import { I18nService } from '@app/service/i18n.service';

interface NotifyOptions {
	action?: NotificationAction;
	timeout?: number | null;
}

const READING_BASE_DURATION = 1200;
const READING_DURATION_PER_WORD = 600;
const MIN_READING_DURATION = 4000;

@Injectable({
	providedIn: 'root',
})
export class NotificationService {
	private readonly notificationList = signal<AppNotification[]>([]);

	readonly notifications = this.notificationList.asReadonly();

	private readonly i18n = inject(I18nService);

	notify(message: TranslationRef, options: NotifyOptions = {}): string {
		const duration =
			undefined === options.timeout ? this.getReadingDuration(message) : options.timeout;

		const notification: AppNotification =
			undefined === options.action
				? { uuid: crypto.randomUUID(), message, duration, leaving: false }
				: { uuid: crypto.randomUUID(), message, duration, leaving: false, action: options.action };

		this.notificationList.update((notifications) => [...notifications, notification]);

		return notification.uuid;
	}

	dismiss(uuid: string): void {
		this.notificationList.update((notifications) =>
			notifications.map((notification) =>
				uuid === notification.uuid ? { ...notification, leaving: true } : notification,
			),
		);
	}

	remove(uuid: string): void {
		this.notificationList.update((notifications) =>
			notifications.filter((notification) => uuid !== notification.uuid),
		);
	}

	private getReadingDuration(message: TranslationRef): number {
		const wordCount = this.i18n.resolve(message).trim().split(/\s+/u).length;

		return Math.max(
			MIN_READING_DURATION,
			READING_BASE_DURATION + wordCount * READING_DURATION_PER_WORD,
		);
	}
}
