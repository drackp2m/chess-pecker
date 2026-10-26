import { Injectable, effect, inject, untracked } from '@angular/core';
import { Router } from '@angular/router';

import { I18n, i18nRef } from '@app/i18n';
import { NotificationService } from '@app/service/notification.service';
import { SessionStore } from '@app/store/session.store';
import { LocalOwnerUseCase } from '@app/use-case/local-owner.use-case';

@Injectable({
	providedIn: 'root',
})
export class LostSessionNoticeUseCase {
	private readonly localOwnerUseCase = inject(LocalOwnerUseCase);
	private readonly notificationService = inject(NotificationService);
	private readonly router = inject(Router);
	private readonly sessionStore = inject(SessionStore);

	private noticeUuid: string | null = null;

	constructor() {
		this.watchSession();
	}

	async check(): Promise<void> {
		if (!this.sessionStore.isAnonymous() || null !== this.noticeUuid) {
			return;
		}

		try {
			const owner = await this.localOwnerUseCase.read();

			if (undefined !== owner) {
				this.notify(owner.username);
			}
		} catch (error) {
			console.error('Could not tell who this device belongs to', error);
		}
	}

	private notify(username: string): void {
		this.noticeUuid = this.notificationService.notify(
			i18nRef(I18n.common.SESSION_LOST, { username }),
			{
				timeout: null,
				action: {
					label: i18nRef(I18n.common.LOG_IN),
					callback: () => {
						this.noticeUuid = null;
						void this.router.navigateByUrl('/login');
					},
				},
			},
		);
	}

	private watchSession(): void {
		effect(() => {
			if (!this.sessionStore.isAuthenticated() || null === this.noticeUuid) {
				return;
			}

			const uuid = this.noticeUuid;

			this.noticeUuid = null;
			untracked(() => {
				this.notificationService.dismiss(uuid);
			});
		});
	}
}
