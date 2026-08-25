import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	LocalDataRepository,
	NO_PENDING,
	PendingCount,
} from '@app/repository/local-data.repository';
import { ActivityStore } from '@app/store/activity.store';
import { ModalStore } from '@app/store/modal.store';
import { ProfileStore } from '@app/store/profile.store';
import { SyncStore } from '@app/store/sync.store';
import { TrainingStore } from '@app/store/training.store';
import { DiscardLocalDataUseCase } from '@app/use-case/discard-local-data.use-case';
import { LocalOwnerUseCase } from '@app/use-case/local-owner.use-case';

interface Options {
	readonly pending?: PendingCount;
	readonly countFails?: boolean;
	readonly puzzleSets?: number;
	readonly answer?: boolean;
}

function withAttempts(attempt: number): PendingCount {
	return { ...NO_PENDING, attempt };
}

function configure(options: Options = {}) {
	const order: string[] = [];
	const localData = {
		countPendingByEntity: vi.fn(() =>
			true === options.countFails
				? Promise.reject(new Error('database closed'))
				: Promise.resolve(options.pending ?? NO_PENDING),
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
	const modalStore = {
		open: vi.fn(() => Promise.resolve({ instance: { onClose$: of(options.answer ?? false) } })),
	};
	const store = (name: string) => ({
		reset: vi.fn(() => {
			order.push(name);
		}),
	});
	const stores = {
		activity: store('activity'),
		profile: store('profile'),
		sync: store('sync'),
		training: store('training'),
	};

	TestBed.configureTestingModule({
		providers: [
			{ provide: LocalDataRepository, useValue: localData },
			{ provide: LocalOwnerUseCase, useValue: localOwner },
			{ provide: ModalStore, useValue: modalStore },
			{ provide: ActivityStore, useValue: stores.activity },
			{ provide: ProfileStore, useValue: stores.profile },
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

		expect(await discard.confirm()).toBe(true);
		expect(modalStore.open).not.toHaveBeenCalled();
	});

	it('asks before dropping work that never reached the server', async () => {
		const { discard, modalStore } = configure({ pending: withAttempts(3), answer: true });

		expect(await discard.confirm()).toBe(true);
		expect(modalStore.open).toHaveBeenCalledTimes(1);
	});

	it('reports the refusal back so the caller can stop', async () => {
		const { discard } = configure({ pending: withAttempts(3), answer: false });

		expect(await discard.confirm()).toBe(false);
	});

	it('counts an imported library as work worth asking about', async () => {
		const { discard, modalStore } = configure({ puzzleSets: 1, answer: true });

		expect(await discard.confirm()).toBe(true);
		expect(modalStore.open).toHaveBeenCalledTimes(1);
	});

	it('asks anyway when it cannot tell what the device holds', async () => {
		const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const { discard, modalStore } = configure({ countFails: true, answer: false });

		expect(await discard.confirm()).toBe(false);
		expect(modalStore.open).toHaveBeenCalledTimes(1);
		expect(logged).toHaveBeenCalled();

		logged.mockRestore();
	});
});

describe('DiscardLocalDataUseCase.execute', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('empties memory before the database, and lets the stamp go last', async () => {
		const { discard, order } = configure();

		await discard.execute();

		expect(order).toEqual(['activity', 'profile', 'sync', 'training', 'clear', 'release']);
	});

	it('resets every store holding user data', async () => {
		const { discard, stores } = configure();

		await discard.execute();

		expect(stores.activity.reset).toHaveBeenCalledTimes(1);
		expect(stores.profile.reset).toHaveBeenCalledTimes(1);
		expect(stores.sync.reset).toHaveBeenCalledTimes(1);
		expect(stores.training.reset).toHaveBeenCalledTimes(1);
	});
});
