import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { PushTrainingResult, SyncEntity } from '@chesspecker/api-definitions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SyncPolicy } from '@app/definition/sync-policy.constant';
import { SyncRepository } from '@app/repository/sync.repository';
import { RekeyUseCase } from '@app/use-case/sync/rekey.use-case';
import { SyncConfirmCount, SyncConfirmUseCase } from '@app/use-case/sync/sync-confirm.use-case';
import { SyncManifest } from '@app/use-case/sync/sync-manifest';
import { SyncPushUseCase } from '@app/use-case/sync/sync-push.use-case';
import { TrainingTreePush, TrainingTreeUseCase } from '@app/use-case/sync/training-tree.use-case';

const TRAINING = 'local-training';

const OTHER_TRAINING = 'local-training-2';

const SERVER_TRAINING = 'server-training';

const RECEIVED_AT = '2026-08-18T10:00:00.000Z';

const [FIRST_BACKOFF, SECOND_BACKOFF] = SyncPolicy.retryBackoffMs;

interface Options {
	readonly pending?: readonly string[];
	readonly pendingAfter?: readonly string[];
	readonly build?: (uuid: string) => TrainingTreePush | undefined;
	readonly send?: () => Promise<PushTrainingResult>;
	readonly settled?: SyncConfirmCount;
	readonly refused?: SyncConfirmCount;
}

function emptyManifest(): SyncManifest {
	return {
		training: [],
		trainingGoal: [],
		calibrationRound: [],
		calibrationPuzzle: [],
		trainingPuzzle: [],
		cycle: [],
		cycleItem: [],
		attempt: [],
	};
}

function emptyUuids(): Record<SyncEntity, Record<string, string>> {
	return {
		training: {},
		trainingGoal: {},
		calibrationRound: {},
		calibrationPuzzle: {},
		trainingPuzzle: {},
		cycle: {},
		cycleItem: {},
		attempt: {},
	};
}

function treePush(trainingUuid: string): TrainingTreePush {
	return {
		trainingUuid,
		request: {
			training: {
				clientRef: trainingUuid,
				status: 'planning',
				goals: [],
				rounds: [],
				puzzles: [],
				cycles: [],
			},
		},
		manifest: { ...emptyManifest(), training: [trainingUuid] },
	};
}

function answer(over: Partial<PushTrainingResult> = {}): PushTrainingResult {
	return { receivedAt: RECEIVED_AT, uuids: emptyUuids(), rejected: [], ...over };
}

function answeredWith(status: number, error: unknown = null): HttpErrorResponse {
	return new HttpErrorResponse({ status, error });
}

function configure(options: Options = {}) {
	const calls: string[] = [];
	let built = 0;

	const buildOnce = (uuid: string): TrainingTreePush | undefined => {
		built += 1;

		return 1 === built ? treePush(uuid) : undefined;
	};

	const trees = {
		listPending: vi
			.fn()
			.mockResolvedValueOnce(options.pending ?? [TRAINING])
			.mockResolvedValue(options.pendingAfter ?? []),
		build: vi.fn((uuid: string) => Promise.resolve((options.build ?? buildOnce)(uuid))),
	};
	const remote = {
		pushTraining: vi.fn(() => {
			calls.push('send');

			return (options.send ?? (() => Promise.resolve(answer())))();
		}),
	};
	const rekey = {
		execute: vi.fn(() => {
			calls.push('rekey');

			return Promise.resolve();
		}),
	};
	const confirmer = {
		execute: vi.fn(() => {
			calls.push('confirm');

			return Promise.resolve(options.settled ?? { confirmed: 1, rejected: 0 });
		}),
		rejectAll: vi.fn(() => {
			calls.push('rejectAll');

			return Promise.resolve(options.refused ?? { confirmed: 0, rejected: 1 });
		}),
	};

	TestBed.configureTestingModule({
		providers: [
			{ provide: TrainingTreeUseCase, useValue: trees },
			{ provide: SyncRepository, useValue: remote },
			{ provide: RekeyUseCase, useValue: rekey },
			{ provide: SyncConfirmUseCase, useValue: confirmer },
		],
	});

	return { calls, trees, remote, rekey, confirmer, push: TestBed.inject(SyncPushUseCase) };
}

describe('SyncPushUseCase', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		TestBed.resetTestingModule();
	});

	it('keys the tree before it seals it', async () => {
		const { push, calls, rekey } = configure();

		await push.execute();

		expect(calls).toEqual(['send', 'rekey', 'confirm']);
		expect(rekey.execute).toHaveBeenCalledWith(TRAINING, emptyUuids());
	});

	it('counts what the answer settled', async () => {
		const { push } = configure({ settled: { confirmed: 4, rejected: 2 } });

		await expect(push.execute()).resolves.toEqual({
			confirmed: 4,
			rejected: 2,
			pendingTrainings: 0,
			interrupted: false,
		});
	});

	it('says how many trees still have something to give when the pass ends', async () => {
		const { push } = configure({ pendingAfter: [OTHER_TRAINING] });

		await expect(push.execute()).resolves.toMatchObject({ pendingTrainings: 1 });
	});

	it('asks for what is left under the uuid the server just handed out', async () => {
		const { push, trees } = configure({
			send: () =>
				Promise.resolve(
					answer({ uuids: { ...emptyUuids(), training: { [TRAINING]: SERVER_TRAINING } } }),
				),
		});

		await push.execute();

		expect(trees.build).toHaveBeenNthCalledWith(1, TRAINING);
		expect(trees.build).toHaveBeenNthCalledWith(2, SERVER_TRAINING);
	});

	it('sends nothing when the tree has nothing left to send', async () => {
		const { push, remote } = configure({ build: () => undefined });

		await expect(push.execute()).resolves.toMatchObject({ interrupted: false });
		expect(remote.pushTraining).not.toHaveBeenCalled();
	});

	describe('when the server answers with its own error', () => {
		it('leaves the rows pending instead of marking them refused', async () => {
			const { push, rekey, confirmer } = configure({
				send: () => Promise.reject(answeredWith(500)),
			});
			const report = push.execute();

			await vi.runAllTimersAsync();

			await expect(report).resolves.toMatchObject({
				confirmed: 0,
				rejected: 0,
				interrupted: true,
			});
			expect(confirmer.rejectAll).not.toHaveBeenCalled();
			expect(confirmer.execute).not.toHaveBeenCalled();
			expect(rekey.execute).not.toHaveBeenCalled();
		});

		it('waits the backoff table out before giving the request up', async () => {
			const { push, remote } = configure({ send: () => Promise.reject(answeredWith(0)) });
			const report = push.execute();

			await vi.advanceTimersByTimeAsync(FIRST_BACKOFF - 1);
			expect(remote.pushTraining).toHaveBeenCalledTimes(1);

			await vi.advanceTimersByTimeAsync(1);
			expect(remote.pushTraining).toHaveBeenCalledTimes(2);

			await vi.advanceTimersByTimeAsync(SECOND_BACKOFF);
			expect(remote.pushTraining).toHaveBeenCalledTimes(SyncPolicy.retryBackoffMs.length + 1);

			await vi.advanceTimersByTimeAsync(SECOND_BACKOFF);
			expect(remote.pushTraining).toHaveBeenCalledTimes(SyncPolicy.retryBackoffMs.length + 1);

			await expect(report).resolves.toMatchObject({ interrupted: true });
		});

		it('leaves the trees behind it for the pass that comes', async () => {
			const { push, trees } = configure({
				pending: [TRAINING, OTHER_TRAINING],
				send: () => Promise.reject(answeredWith(503)),
			});
			const report = push.execute();

			await vi.runAllTimersAsync();

			await expect(report).resolves.toMatchObject({ interrupted: true });
			expect(trees.build).toHaveBeenCalledTimes(1);
			expect(trees.build).toHaveBeenCalledWith(TRAINING);
		});
	});

	describe('when the server refuses the tree', () => {
		it('marks everything that travelled with the reason it came back with', async () => {
			const { push, confirmer, rekey } = configure({
				send: () => Promise.reject(answeredWith(422, { message: { training: 'unknown goal' } })),
			});

			await expect(push.execute()).resolves.toMatchObject({
				rejected: 1,
				interrupted: false,
			});
			expect(confirmer.rejectAll).toHaveBeenCalledWith(
				expect.objectContaining({ trainingUuid: TRAINING }),
				'training/unknown goal',
			);
			expect(rekey.execute).not.toHaveBeenCalled();
		});

		it('falls back to the status when the answer carries no reason', async () => {
			const { push, confirmer } = configure({ send: () => Promise.reject(answeredWith(409)) });

			await push.execute();

			expect(confirmer.rejectAll).toHaveBeenCalledWith(expect.anything(), 'HTTP 409');
		});

		it('does not try the same request again', async () => {
			const { push, remote } = configure({ send: () => Promise.reject(answeredWith(400)) });

			await push.execute();

			expect(remote.pushTraining).toHaveBeenCalledTimes(1);
		});
	});

	describe('a tree that does not fit in one request', () => {
		it('stops asking when a request settles nothing', async () => {
			const { push, remote } = configure({
				build: (uuid) => treePush(uuid),
				settled: { confirmed: 0, rejected: 0 },
			});

			await expect(push.execute()).resolves.toMatchObject({ interrupted: false });
			expect(remote.pushTraining).toHaveBeenCalledTimes(1);
		});

		it('sends no more requests than the pass allows', async () => {
			const { push, remote } = configure({ build: (uuid) => treePush(uuid) });

			await push.execute();

			expect(remote.pushTraining).toHaveBeenCalledTimes(SyncPolicy.maxRequestsPerRun);
		});
	});
});
