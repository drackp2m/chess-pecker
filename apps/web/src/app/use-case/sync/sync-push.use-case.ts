import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { PushTrainingResult } from '@chesspecker/api-definitions';

import { SyncPolicy } from '@app/definition/sync-policy.constant';
import { SyncRepository } from '@app/repository/sync.repository';
import { RekeyUseCase } from '@app/use-case/sync/rekey.use-case';
import {
	NOTHING_SETTLED,
	SyncConfirmCount,
	SyncConfirmUseCase,
	addSettled,
} from '@app/use-case/sync/sync-confirm.use-case';
import { TrainingTreePush, TrainingTreeUseCase } from '@app/use-case/sync/training-tree.use-case';
import { HttpError } from '@app/util/http-error';

export interface SyncPushReport {
	readonly confirmed: number;
	readonly rejected: number;
	/** Trainings still holding something to push when the pass ends. */
	readonly pendingTrainings: number;
	/** Cut short by something transient: the network, a 5xx, a request that never returned. */
	readonly interrupted: boolean;
}

type PushAnswer =
	| { readonly kind: 'answered'; readonly result: PushTrainingResult }
	| { readonly kind: 'refused'; readonly reason: string }
	| { readonly kind: 'unreachable' };

interface PushOutcome {
	readonly settled: SyncConfirmCount;
	readonly interrupted: boolean;
}

interface PushPass extends PushOutcome {
	/** The training's final uuid, when this request is the one that just gave it one. */
	readonly trainingUuid: string | undefined;
}

/**
 * A 4xx over the whole tree is not a data clash but a request the server will never accept,
 * and retrying it would spin in place forever. A 413 is one of them: with the byte budget the
 * tree already fits, so being over the ceiling means one row is too big on its own.
 */
const REFUSING_STATUS = new Set([400, 403, 409, 413, 422]);

/**
 * Everything written here and not up there, pushed on its own. The unit is a training's tree,
 * and a cut push repeats safely: the server looks up the retry key before inserting.
 */
@Injectable({
	providedIn: 'root',
})
export class SyncPushUseCase {
	private readonly trees = inject(TrainingTreeUseCase);
	private readonly remote = inject(SyncRepository);
	private readonly rekey = inject(RekeyUseCase);
	private readonly confirmer = inject(SyncConfirmUseCase);

	async execute(): Promise<SyncPushReport> {
		let settled = NOTHING_SETTLED;
		let interrupted = false;

		for (const trainingUuid of await this.trees.listPending()) {
			const outcome = await this.pushTraining(trainingUuid);

			settled = addSettled(settled, outcome.settled);

			// The network will not be back for the next tree: the rest waits for the next pass.
			if (outcome.interrupted) {
				interrupted = true;

				break;
			}
		}

		const pending = await this.trees.listPending();

		return { ...settled, pendingTrainings: pending.length, interrupted };
	}

	/** One tree in as many requests as it takes: what does not fit goes in the next. */
	private async pushTraining(uuid: string): Promise<PushOutcome> {
		let trainingUuid = uuid;
		let settled = NOTHING_SETTLED;

		for (let request = 0; request < SyncPolicy.maxRequestsPerRun; request += 1) {
			const push = await this.trees.build(trainingUuid);

			if (undefined === push) {
				break;
			}

			const pass = await this.pushOnce(push);

			settled = addSettled(settled, pass.settled);
			trainingUuid = pass.trainingUuid ?? trainingUuid;

			// With not one row sealed or refused, sending the same again would change nothing.
			if (pass.interrupted || 0 === pass.settled.confirmed + pass.settled.rejected) {
				return { settled, interrupted: pass.interrupted };
			}
		}

		return { settled, interrupted: false };
	}

	private async pushOnce(push: TrainingTreePush): Promise<PushPass> {
		const answer = await this.send(push);

		if ('unreachable' === answer.kind) {
			return { settled: NOTHING_SETTLED, interrupted: true, trainingUuid: undefined };
		}

		if ('refused' === answer.kind) {
			const settled = await this.confirmer.rejectAll(push, answer.reason);

			return { settled, interrupted: false, trainingUuid: undefined };
		}

		// Keys before seals: sealing a row that has not moved yet would leave the server on one
		// uuid and this side on another.
		await this.rekey.execute(push.trainingUuid, answer.result.uuids);

		return {
			settled: await this.confirmer.execute(push, answer.result),
			interrupted: false,
			trainingUuid: answer.result.uuids.training[push.trainingUuid],
		};
	}

	private async send(push: TrainingTreePush): Promise<PushAnswer> {
		for (let attempt = 0; attempt <= SyncPolicy.retryBackoffMs.length; attempt += 1) {
			try {
				return { kind: 'answered', result: await this.remote.pushTraining(push.request) };
			} catch (error) {
				const reason = toRefusal(error);

				if (undefined !== reason) {
					return { kind: 'refused', reason };
				}

				const backoff = SyncPolicy.retryBackoffMs[attempt];

				if (undefined !== backoff) {
					await wait(backoff);
				}
			}
		}

		return { kind: 'unreachable' };
	}
}

function toRefusal(error: unknown): string | undefined {
	if (!(error instanceof HttpErrorResponse) || !REFUSING_STATUS.has(error.status)) {
		return undefined;
	}

	return HttpError.toFailure(error) ?? `HTTP ${error.status.toString()}`;
}

function wait(delay: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve();
		}, delay);
	});
}
