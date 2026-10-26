import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TranslationRef } from '@app/definition/i18n.type';
import { LocalOwner } from '@app/definition/model/setting/local-owner.type';
import { NotificationAction } from '@app/definition/service/notification.interface';
import { SessionStatus } from '@app/definition/session-status.type';
import { NotificationService } from '@app/service/notification.service';
import { SessionStore } from '@app/store/session.store';
import { LocalOwnerUseCase } from '@app/use-case/local-owner.use-case';
import { LostSessionNoticeUseCase } from '@app/use-case/lost-session-notice.use-case';

const NOTICE = 'notice-uuid';

const adaStamp: LocalOwner = { uuid: 'uuid-ada', username: 'ada' };

interface NotifyOptions {
	readonly action?: NotificationAction;
	readonly timeout?: number | null;
}

interface Options {
	readonly status: SessionStatus;
	readonly owner?: LocalOwner;
}

function configure(options: Options) {
	const status = signal<SessionStatus>(options.status);
	const notifications = {
		notify: vi.fn((_message: TranslationRef, _options?: NotifyOptions) => NOTICE),
		dismiss: vi.fn((_uuid: string) => undefined),
	};
	const router = { navigateByUrl: vi.fn((_url: string) => Promise.resolve(true)) };

	TestBed.configureTestingModule({
		providers: [
			{
				provide: SessionStore,
				useValue: {
					status,
					isAnonymous: computed(() => 'anonymous' === status()),
					isAuthenticated: computed(() => 'authenticated' === status()),
				},
			},
			{ provide: LocalOwnerUseCase, useValue: { read: () => Promise.resolve(options.owner) } },
			{ provide: NotificationService, useValue: notifications },
			{ provide: Router, useValue: router },
		],
	});

	return { status, notifications, router, notice: TestBed.inject(LostSessionNoticeUseCase) };
}

describe('LostSessionNoticeUseCase', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('warns that the progress is not syncing when the session of the owner is gone', async () => {
		const { notice, notifications } = configure({ status: 'anonymous', owner: adaStamp });

		await notice.check();

		expect(notifications.notify).toHaveBeenCalledTimes(1);
		expect(notifications.notify.mock.calls[0]?.[0].params).toEqual({ username: 'ada' });
		expect(notifications.notify.mock.calls[0]?.[1]?.timeout).toBeNull();
	});

	it('says nothing on a device nobody had claimed', async () => {
		const { notice, notifications } = configure({ status: 'anonymous' });

		await notice.check();

		expect(notifications.notify).not.toHaveBeenCalled();
	});

	it('says nothing while the session is open', async () => {
		const { notice, notifications } = configure({ status: 'authenticated', owner: adaStamp });

		await notice.check();

		expect(notifications.notify).not.toHaveBeenCalled();
	});

	it('says nothing when the server could not be asked', async () => {
		const { notice, notifications } = configure({ status: 'unreachable', owner: adaStamp });

		await notice.check();

		expect(notifications.notify).not.toHaveBeenCalled();
	});

	it('takes the user to log in from the notice', async () => {
		const { notice, notifications, router } = configure({ status: 'anonymous', owner: adaStamp });

		await notice.check();
		notifications.notify.mock.calls[0]?.[1]?.action?.callback();

		expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
	});

	it('withdraws the notice once a session opens', async () => {
		const { notice, notifications, status } = configure({ status: 'anonymous', owner: adaStamp });

		await notice.check();
		status.set('authenticated');
		TestBed.tick();

		expect(notifications.dismiss).toHaveBeenCalledWith(NOTICE);
	});
});
