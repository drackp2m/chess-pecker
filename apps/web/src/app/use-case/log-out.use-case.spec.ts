import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LocalDataRepository, UnsavedCount } from '@app/repository/local-data.repository';
import { ModalStore } from '@app/store/modal.store';
import { SessionStore } from '@app/store/session.store';
import { SyncStore } from '@app/store/sync.store';
import { DiscardLocalDataUseCase } from '@app/use-case/discard-local-data.use-case';
import { LogOutUseCase } from '@app/use-case/log-out.use-case';

interface Options {
	readonly unsaved?: UnsavedCount;
	readonly countFails?: boolean;
	readonly answer?: boolean;
	readonly loggedOut?: boolean;
}

const NOTHING_UNSAVED: UnsavedCount = { pending: 0, rejected: 0 };

function configure(options: Options = {}) {
	const order: string[] = [];
	const localData = {
		countUnsavedSync: vi.fn(() =>
			true === options.countFails
				? Promise.reject(new Error('database closed'))
				: Promise.resolve(options.unsaved ?? NOTHING_UNSAVED),
		),
	};
	const modalStore = {
		open: vi.fn(() => Promise.resolve({ instance: { onClose$: of(options.answer ?? false) } })),
	};
	const sessionStore = {
		logOut: vi.fn(() => {
			order.push('logOut');

			return Promise.resolve(options.loggedOut ?? true);
		}),
	};
	const syncStore = {
		flush: vi.fn(() => {
			order.push('flush');

			return Promise.resolve();
		}),
	};
	const discard = {
		execute: vi.fn(() => {
			order.push('discard');

			return Promise.resolve();
		}),
	};

	TestBed.configureTestingModule({
		providers: [
			{ provide: LocalDataRepository, useValue: localData },
			{ provide: ModalStore, useValue: modalStore },
			{ provide: SessionStore, useValue: sessionStore },
			{ provide: SyncStore, useValue: syncStore },
			{ provide: DiscardLocalDataUseCase, useValue: discard },
		],
	});

	return {
		localData,
		modalStore,
		sessionStore,
		syncStore,
		discard,
		order,
		logOut: TestBed.inject(LogOutUseCase),
	};
}

describe('LogOutUseCase', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('pushes what is waiting before asking anything', async () => {
		const { logOut, order } = configure();

		expect(await logOut.execute()).toBe(true);
		expect(order).toEqual(['flush', 'logOut', 'discard']);
	});

	it('closes without a word when the push emptied the device', async () => {
		const { logOut, modalStore } = configure();

		expect(await logOut.execute()).toBe(true);
		expect(modalStore.open).not.toHaveBeenCalled();
	});

	it('warns about rows the server refused, which stopped being pending', async () => {
		const { logOut, modalStore } = configure({
			unsaved: { pending: 0, rejected: 601 },
			answer: true,
		});

		expect(await logOut.execute()).toBe(true);
		expect(modalStore.open).toHaveBeenCalledTimes(1);
	});

	it('warns about what never went up either', async () => {
		const { logOut, modalStore } = configure({
			unsaved: { pending: 4, rejected: 0 },
			answer: true,
		});

		expect(await logOut.execute()).toBe(true);
		expect(modalStore.open).toHaveBeenCalledTimes(1);
	});

	it('keeps the session and the data when the warning is turned down', async () => {
		const { logOut, sessionStore, discard } = configure({
			unsaved: { pending: 0, rejected: 2 },
			answer: false,
		});

		expect(await logOut.execute()).toBe(false);
		expect(sessionStore.logOut).not.toHaveBeenCalled();
		expect(discard.execute).not.toHaveBeenCalled();
	});

	it('warns anyway when it cannot tell what the device holds', async () => {
		const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const { logOut, modalStore } = configure({ countFails: true, answer: false });

		expect(await logOut.execute()).toBe(false);
		expect(modalStore.open).toHaveBeenCalledTimes(1);
		expect(logged).toHaveBeenCalled();

		logged.mockRestore();
	});

	it('leaves the device as it was when the API could not close the session', async () => {
		const { logOut, discard } = configure({ loggedOut: false });

		expect(await logOut.execute()).toBe(false);
		expect(discard.execute).not.toHaveBeenCalled();
	});

	it('still closes when the wipe fails, because the session is already gone', async () => {
		const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const { logOut, discard } = configure();

		discard.execute.mockRejectedValueOnce(new Error('database closed'));

		expect(await logOut.execute()).toBe(true);
		expect(logged).toHaveBeenCalled();

		logged.mockRestore();
	});
});
