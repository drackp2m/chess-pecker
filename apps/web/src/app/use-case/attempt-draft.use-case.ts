import { Injectable, inject } from '@angular/core';
import type { PuzzleAttemptClosure, PuzzleAttemptKind } from '@chesspecker/api-definitions';

import { PuzzleRecord } from '@app/definition/puzzle.type';
import { AttemptRepository } from '@app/repository/attempt.repository';
import { AttemptDraftRow } from '@app/repository/definition/attempt-draft-schema.interface';
import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
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
	/** Its place in the pass, so the row can name it without the plan in front of it. */
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

@Injectable({
	providedIn: 'root',
})
export class AttemptDraftUseCase {
	private readonly repository = inject(AttemptRepository);

	find(identity: AttemptIdentity): Promise<AttemptDraftRow | undefined> {
		return this.repository.find('attemptDraft', toSlotId(identity));
	}

	/**
	 * The slot the attempt fills, which is what it is recognised by: each side issues its own
	 * uuid, so matching on that would duplicate what is already here.
	 */
	findClosed(identity: AttemptIdentity): Promise<AttemptRow | undefined> {
		if (undefined !== identity.cycleItemUuid) {
			return this.repository.findByIndex('attempt', 'cycleItemUuid', identity.cycleItemUuid);
		}

		if (undefined === identity.roundUuid) {
			return Promise.resolve(undefined);
		}

		return this.repository.findByIndex('attempt', 'roundUuid-puzzleUuid', [
			identity.roundUuid,
			identity.puzzleUuid,
		]);
	}

	async save(draft: AttemptDraft, progress: AttemptProgress): Promise<void> {
		await this.repository.insert('attemptDraft', this.toDraftRow(draft, progress));
	}

	/**
	 * Closing an exercise is one transaction — the attempt in, the draft out — so there is no
	 * instant where the same slot is in both places or in neither.
	 */
	async seal(draft: AttemptDraft, outcome: AttemptOutcome): Promise<void> {
		const row = this.toAttemptRow(draft, outcome);
		const slotId = toSlotId(draft.identity);

		await this.repository.runInTransaction(
			['attempt', 'attemptDraft'],
			'readwrite',
			async (transaction) => {
				await transaction.objectStore('attempt').put(row);
				await transaction.objectStore('attemptDraft').delete(slotId);
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
			explorations: progress.explorations,
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
			explorations: outcome.explorations,
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
