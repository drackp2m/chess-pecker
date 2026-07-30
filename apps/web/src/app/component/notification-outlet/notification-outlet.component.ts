import { Component, ElementRef, inject, signal } from '@angular/core';

import { AppNotification } from '@app/definition/service/notification.interface';
import { ButtonDirective } from '@app/directive/button.directive';
import { NotificationService } from '@app/service/notification.service';

@Component({
	selector: 'app-notification-outlet',
	templateUrl: './notification-outlet.component.html',
	styleUrl: './notification-outlet.component.scss',
	imports: [ButtonDirective],
	host: {
		'(document:pointerdown)': 'onDocumentPointerDown($event)',
	},
})
export class NotificationOutletComponent {
	private readonly notificationService = inject(NotificationService);
	private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
	private readonly finishedLeaveAnimations = new Map<string, number>();
	private readonly pausedUuid = signal<string | null>(null);

	readonly notifications = this.notificationService.notifications;

	isPaused(notification: AppNotification): boolean {
		return notification.uuid === this.pausedUuid();
	}

	onNotificationPointerDown(notification: AppNotification, event: PointerEvent): void {
		if ('mouse' === event.pointerType) {
			return;
		}

		this.pausedUuid.set(notification.uuid);
	}

	onDocumentPointerDown(event: PointerEvent): void {
		if (event.target instanceof Node && this.elementRef.nativeElement.contains(event.target)) {
			return;
		}

		this.pausedUuid.set(null);
	}

	runAction(notification: AppNotification): void {
		notification.action?.callback();
		this.notificationService.dismiss(notification.uuid);
	}

	dismiss(notification: AppNotification): void {
		this.notificationService.dismiss(notification.uuid);
	}

	onCountdownEnd(notification: AppNotification): void {
		this.notificationService.dismiss(notification.uuid);
	}

	onWrapperAnimationEnd(notification: AppNotification, event: AnimationEvent): void {
		const isLeaveAnimation =
			event.animationName.endsWith('notification-close') ||
			event.animationName.endsWith('notification-leave');

		if (!notification.leaving || !isLeaveAnimation) {
			return;
		}

		const finishedCount = (this.finishedLeaveAnimations.get(notification.uuid) ?? 0) + 1;

		if (2 > finishedCount) {
			this.finishedLeaveAnimations.set(notification.uuid, finishedCount);

			return;
		}

		this.finishedLeaveAnimations.delete(notification.uuid);
		this.notificationService.remove(notification.uuid);

		if (notification.uuid === this.pausedUuid()) {
			this.pausedUuid.set(null);
		}
	}
}
