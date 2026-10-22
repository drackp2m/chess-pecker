import { Injectable, inject } from '@angular/core';
import type { PuzzleAttemptClosure, PuzzleAttemptKind } from '@chesspecker/api-definitions';
import { StoreNames } from 'idb';

import { PuzzleRecord } from '@app/definition/puzzle.type';
import { AttemptRepository } from '@app/repository/attempt.repository';
import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { AttemptDraftRow } from '@app/repository/definition/attempt-draft-schema.interface';
import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { RepositoryTransaction } from '@app/repository/generic.repository';
import { currentKey } from '@app/use-case/sync/local-key.use-case';
import { born } from '@app/use-case/sync/local-record';

export interface AttemptIdentity {
	readonly trainingUuid: string;
	readonly kind: PuzzleAttemptKind;
	readonly puzzleUuid: string;
	readonly lichessId: string;
	readonly roundUuid?: string;
	readonly cycleItemUuid?: string;
}

export interface AttemptDraft {
	readonly uuid: string;
	readonly identity: AttemptIdentity;
	readonly createdAt: Date;
	/** Its place in the cycle, so the row can name it without the plan in front of it. */
	readonly position?: number;
}

export interface AttemptProgress extends PuzzleRecord {
	readonly durationMs: number;
	readonly updatedAt: Date;
	readonly hintUsed: boolean;
	readonly mistakeCount: number;
	readonly solved?: boolean;
}

export interface AttemptOutcome extends AttemptProgress {
	readonly closure: PuzzleAttemptClosure;
	readonly solved: boolean;
}

export function toSlotId(identity: AttemptIdentity): string {
	if (undefined !== identity.cycleItemUuid) {
		return identity.cycleItemUuid;
	}

	return `${identity.trainingUuid}/${identity.roundUuid ?? ''}/${identity.puzzleUuid}`;
}

const IDENTITY_STORES: StoreNames<AppSchema>[] = ['training', 'calibrationRound', 'cycleItem'];

async function currentIdentity<M extends 'readonly' | 'readwrite'>(
	transaction: RepositoryTransaction<AppSchema, M>,
	identity: AttemptIdentity,
): Promise<AttemptIdentity> {
	const { roundUuid, cycleItemUuid } = identity;

	return {
		...identity,
		trainingUuid: await currentKey(transaction, 'training', identity.trainingUuid),
		...(undefined === roundUuid
			? {}
			: { roundUuid: await currentKey(transaction, 'calibrationRound', roundUuid) }),
		...(undefined === cycleItemUuid
			? {}
			: { cycleItemUuid: await currentKey(transaction, 'cycleItem', cycleItemUuid) }),
	};
}

async function currentDraft<M extends 'readonly' | 'readwrite'>(
	transaction: RepositoryTransaction<AppSchema, M>,
	draft: AttemptDraft,
): Promise<AttemptDraft> {
	return { ...draft, identity: await currentIdentity(transaction, draft.identity) };
}

@Injectable({
	providedIn: 'root',
})
export class AttemptDraftUseCase {
	private readonly repository = inject(AttemptRepository);

	find(identity: AttemptIdentity): Promise<AttemptDraftRow | undefined> {
		return this.repository.runInTransaction(
			[...IDENTITY_STORES, 'attemptDraft'],
			'readonly',
			async (transaction) => {
				const current = await currentIdentity(transaction, identity);

				return transaction.objectStore('attemptDraft').get(toSlotId(current));
			},
		);
	}

	/**
	 * The slot the attempt fills, which is what it is recognised by: each side issues its own
	 * uuid, so matching on that would duplicate what is already here.
	 */
	findClosed(identity: AttemptIdentity): Promise<AttemptRow | undefined> {
		return this.repository.runInTransaction(
			[...IDENTITY_STORES, 'attempt'],
			'readonly',
			async (transaction) => {
				const current = await currentIdentity(transaction, identity);
				const attempts = transaction.objectStore('attempt');

				if (undefined !== current.cycleItemUuid) {
					return attempts.index('cycleItemUuid').get(current.cycleItemUuid);
				}

				return undefined === current.roundUuid
					? undefined
					: attempts.index('roundUuid-puzzleUuid').get([current.roundUuid, current.puzzleUuid]);
			},
		);
	}

	async save(draft: AttemptDraft, progress: AttemptProgress): Promise<void> {
		await this.repository.runInTransaction(
			[...IDENTITY_STORES, 'attemptDraft'],
			'readwrite',
			async (transaction) => {
				const current = await currentDraft(transaction, draft);

				await transaction.objectStore('attemptDraft').put(this.toDraftRow(current, progress));
			},
		);
	}

	/**
	 * Closing an exercise is one transaction — the attempt in, the draft out — so there is no
	 * instant where the same slot is in both places or in neither.
	 */
	async seal(draft: AttemptDraft, outcome: AttemptOutcome): Promise<void> {
		await this.repository.runInTransaction(
			[...IDENTITY_STORES, 'attempt', 'attemptDraft'],
			'readwrite',
			async (transaction) => {
				const current = await currentDraft(transaction, draft);

				await transaction.objectStore('attempt').put(this.toAttemptRow(current, outcome));
				await transaction.objectStore('attemptDraft').delete(toSlotId(current.identity));
			},
		);
	}

	private toDraftRow(draft: AttemptDraft, progress: AttemptProgress): AttemptDraftRow {
		const { identity } = draft;

		return {
			slotId: toSlotId(identity),
			uuid: draft.uuid,
			trainingUuid: identity.trainingUuid,
			kind: identity.kind,
			puzzleUuid: identity.puzzleUuid,
			lichessId: identity.lichessId,
			durationMs: progress.durationMs,
			record: progress.record,
			freePlayRuns: progress.freePlayRuns,
			hintUsed: progress.hintUsed,
			mistakeCount: progress.mistakeCount,
			createdAt: draft.createdAt,
			updatedAt: progress.updatedAt,
			...(undefined === draft.position ? {} : { position: draft.position }),
			...(undefined === identity.roundUuid ? {} : { roundUuid: identity.roundUuid }),
			...(undefined === identity.cycleItemUuid ? {} : { cycleItemUuid: identity.cycleItemUuid }),
			...(undefined === progress.solved ? {} : { solved: progress.solved }),
		};
	}

	private toAttemptRow(draft: AttemptDraft, outcome: AttemptOutcome): AttemptRow {
		const { identity } = draft;

		return born<AttemptRow>({
			uuid: draft.uuid,
			trainingUuid: identity.trainingUuid,
			kind: identity.kind,
			puzzleUuid: identity.puzzleUuid,
			lichessId: identity.lichessId,
			durationMs: outcome.durationMs,
			record: outcome.record,
			freePlayRuns: outcome.freePlayRuns,
			solved: outcome.solved,
			closure: outcome.closure,
			hintUsed: outcome.hintUsed,
			mistakeCount: outcome.mistakeCount,
			createdAt: draft.createdAt,
			updatedAt: outcome.updatedAt,
			...(undefined === draft.position ? {} : { position: draft.position }),
			...(undefined === identity.roundUuid ? {} : { roundUuid: identity.roundUuid }),
			...(undefined === identity.cycleItemUuid ? {} : { cycleItemUuid: identity.cycleItemUuid }),
		});
	}
}
