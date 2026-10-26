import { TestBed } from '@angular/core/testing';
import type { SyncEntity } from '@chesspecker/api-definitions';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SYNC_ENTITIES } from '@app/definition/sync-entity.constant';
import {
	LocalDataRepository,
	NO_UNSAVED,
	UnsavedByEntity,
	UnsavedCount,
} from '@app/repository/local-data.repository';
import { ActivityStore } from '@app/store/activity.store';
import { BookmarkStore } from '@app/store/bookmark.store';
import { ModalStore } from '@app/store/modal.store';
import { NotificationStore } from '@app/store/notification.store';
import { ProfileStore } from '@app/store/profile.store';
import { ShareStore } from '@app/store/share.store';
import { SyncStore } from '@app/store/sync.store';
import { TrainingStore } from '@app/store/training.store';
import { BookmarkMirrorUseCase } from '@app/use-case/bookmark-mirror.use-case';
import { DiscardContext, DiscardLocalDataUseCase } from '@app/use-case/discard-local-data.use-case';
import { LocalOwnerUseCase } from '@app/use-case/local-owner.use-case';
import { SYNC_LOCK, withExclusiveLock } from '@app/util/exclusive-lock';

interface Options {
	readonly unsaved?: UnsavedByEntity;
	readonly countFails?: boolean;
	readonly puzzleSets?: number;
	readonly answer?: boolean;
}

const LOGGING_IN: DiscardContext = { action: 'log-in', owner: undefined };

const NOTHING_UNSAVED: UnsavedByEntity = Object.fromEntries(
	SYNC_ENTITIES.map((entity): readonly [SyncEntity, UnsavedCount] => [entity, NO_UNSAVED]),
) as UnsavedByEntity;

function withAttempts(attempt: UnsavedCount): UnsavedByEntity {
	return { ...NOTHING_UNSAVED, attempt };
}

function holdSyncLock(): () => void {
	let release: () => void = () => undefined;
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});

	void withExclusiveLock(SYNC_LOCK, () => held);

	return () => {
		release();
	};
}

function nextTask(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve();
		}, 0);
	});
}

function configure(options: Options = {}) {
	const order: string[] = [];
	const localData = {
		countUnsavedByEntity: vi.fn(() =>
			true === options.countFails
				? Promise.reject(new Error('database closed'))
				: Promise.resolve(options.unsaved ?? NOTHING_UNSAVED),
		),
		countPuzzleSets: vi.fn(() => Promise.resolve(options.puzzleSets ?? 0)),
		clearUserData: vi.fn(() => {
			order.push('clear');

			return Promise.resolve();
		}),
	};
	const localOwner = {
		release: vi.fn(() => {
			order.push('release');

			return Promise.resolve();
		}),
	};
	const bookmarks = {
		hasPending: vi.fn(() => Promise.resolve(false)),
	};
	const modalStore = {
		open: vi.fn(() =>
			Promise.resolve({
				instance: { onClose$: of(options.answer ?? false) },
				setInput: vi.fn((_name: string, _value: unknown) => undefined),
			}),
		),
	};
	const store = (name: string) => ({
		reset: vi.fn(() => {
			order.push(name);
		}),
	});
	const stores = {
		activity: store('activity'),
		bookmark: store('bookmark'),
		notification: store('notification'),
		profile: store('profile'),
		share: store('share'),
		sync: store('sync'),
		training: store('training'),
	};

	TestBed.configureTestingModule({
		providers: [
			{ provide: LocalDataRepository, useValue: localData },
			{ provide: LocalOwnerUseCase, useValue: localOwner },
			{ provide: BookmarkMirrorUseCase, useValue: bookmarks },
			{ provide: ModalStore, useValue: modalStore },
			{ provide: ActivityStore, useValue: stores.activity },
			{ provide: BookmarkStore, useValue: stores.bookmark },
			{ provide: NotificationStore, useValue: stores.notification },
			{ provide: ProfileStore, useValue: stores.profile },
			{ provide: ShareStore, useValue: stores.share },
			{ provide: SyncStore, useValue: stores.sync },
			{ provide: TrainingStore, useValue: stores.training },
		],
	});

	return {
		localData,
		localOwner,
		modalStore,
		stores,
		order,
		discard: TestBed.inject(DiscardLocalDataUseCase),
	};
}

describe('DiscardLocalDataUseCase.confirm', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('goes ahead without asking when there is nothing to lose', async () => {
		const { discard, modalStore } = configure();

		expect(await discard.confirm(LOGGING_IN)).toBe(true);
		expect(modalStore.open).not.toHaveBeenCalled();
	});

	it('asks before dropping work that never reached the server', async () => {
		const unsaved = withAttempts({ pending: 3, rejected: 0 });
		const { discard, modalStore } = configure({ unsaved, answer: true });

		expect(await discard.confirm(LOGGING_IN)).toBe(true);
		expect(modalStore.open).toHaveBeenCalledTimes(1);
	});

	it('reports the refusal back so the caller can stop', async () => {
		const unsaved = withAttempts({ pending: 3, rejected: 0 });
		const { discard } = configure({ unsaved, answer: false });

		expect(await discard.confirm(LOGGING_IN)).toBe(false);
	});

	it('asks about work the server refused, which is not pending any more', async () => {
		const unsaved = withAttempts({ pending: 0, rejected: 2 });
		const { discard, modalStore } = configure({ unsaved, answer: true });

		expect(await discard.confirm(LOGGING_IN)).toBe(true);
		expect(modalStore.open).toHaveBeenCalledTimes(1);
	});

	it('counts an imported library as work worth asking about', async () => {
		const { discard, modalStore } = configure({ puzzleSets: 1, answer: true });

		expect(await discard.confirm(LOGGING_IN)).toBe(true);
		expect(modalStore.open).toHaveBeenCalledTimes(1);
	});

	it('tells the warning what is being done and whose the device is', async () => {
		const unsaved = withAttempts({ pending: 3, rejected: 0 });
		const { discard, modalStore } = configure({ unsaved, answer: true });

		await discard.confirm({ action: 'register', owner: { uuid: 'uuid-ada', username: 'ada' } });

		const modal = await modalStore.open.mock.results[0]?.value;

		expect(modal?.setInput).toHaveBeenCalledWith('action', 'register');
		expect(modal?.setInput).toHaveBeenCalledWith('owner', 'ada');
	});

	it('asks anyway when it cannot tell what the device holds', async () => {
		const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const { discard, modalStore } = configure({ countFails: true, answer: false });

		expect(await discard.confirm(LOGGING_IN)).toBe(false);
		expect(modalStore.open).toHaveBeenCalledTimes(1);
		expect(logged).toHaveBeenCalled();

		logged.mockRestore();
	});
});

describe('DiscardLocalDataUseCase.execute', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('resets the stores after the wipe, not before', async () => {
		const { discard, order } = configure();

		await discard.execute();

		expect(order).toEqual([
			'clear',
			'release',
			'activity',
			'bookmark',
			'notification',
			'profile',
			'share',
			'sync',
			'training',
		]);
	});

	it('resets every store holding user data', async () => {
		const { discard, stores } = configure();

		await discard.execute();

		expect(stores.activity.reset).toHaveBeenCalledTimes(1);
		expect(stores.bookmark.reset).toHaveBeenCalledTimes(1);
		expect(stores.notification.reset).toHaveBeenCalledTimes(1);
		expect(stores.profile.reset).toHaveBeenCalledTimes(1);
		expect(stores.share.reset).toHaveBeenCalledTimes(1);
		expect(stores.sync.reset).toHaveBeenCalledTimes(1);
		expect(stores.training.reset).toHaveBeenCalledTimes(1);
	});
});

describe('DiscardLocalDataUseCase.execute, while a pass holds the sync lock', () => {
	let releasePass: () => void = () => undefined;

	afterEach(() => {
		releasePass();
		TestBed.resetTestingModule();
	});

	it('waits for the pass holding the sync lock before wiping', async () => {
		const { discard, localData, stores } = configure();

		releasePass = holdSyncLock();

		const wiping = discard.execute();

		await nextTask();

		expect(localData.clearUserData).not.toHaveBeenCalled();
		expect(stores.sync.reset).not.toHaveBeenCalled();

		releasePass();
		await wiping;
	});

	it('wipes as soon as the pass lets the lock go', async () => {
		const { discard, localData, localOwner } = configure();

		releasePass = holdSyncLock();

		const wiping = discard.execute();

		releasePass();
		await wiping;

		expect(localData.clearUserData).toHaveBeenCalledTimes(1);
		expect(localOwner.release).toHaveBeenCalledTimes(1);
	});
});
