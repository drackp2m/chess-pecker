import { Injectable, inject } from '@angular/core';
import type { PuzzleAttemptKind } from '@chesspecker/api-definitions';

import { PieceColor } from '@app/definition/chess.type';
import { PuzzleClosure, PuzzleRecord } from '@app/definition/puzzle.type';
import { AttemptRepository } from '@app/repository/attempt.repository';
import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';

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
}

export interface AttemptProgress extends PuzzleRecord {
	readonly durationMs: number;
	readonly updatedAt: Date;
	readonly orientation: PieceColor;
	readonly closure: PuzzleClosure;
	readonly hintUsed: boolean;
	readonly mistakeCount: number;
	readonly startedAt?: Date;
	readonly solved?: boolean;
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

	find(identity: AttemptIdentity): Promise<AttemptRow | undefined> {
		return this.repository.findByIndex('attempt', 'slotId', toSlotId(identity));
	}

	async save(draft: AttemptDraft, progress: AttemptProgress): Promise<void> {
		await this.repository.insert('attempt', this.toRow(draft, progress));
	}

	private toRow(draft: AttemptDraft, progress: AttemptProgress): AttemptRow {
		const { identity } = draft;

		return {
			uuid: draft.uuid,
			trainingUuid: identity.trainingUuid,
			kind: identity.kind,
			slotId: toSlotId(identity),
			puzzleUuid: identity.puzzleUuid,
			lichessId: identity.lichessId,
			durationMs: progress.durationMs,
			record: progress.record,
			explorations: progress.explorations,
			orientation: progress.orientation,
			closure: progress.closure,
			hintUsed: progress.hintUsed,
			mistakeCount: progress.mistakeCount,
			createdAt: draft.createdAt,
			updatedAt: progress.updatedAt,
			...(undefined === identity.roundUuid ? {} : { roundUuid: identity.roundUuid }),
			...(undefined === identity.cycleItemUuid ? {} : { cycleItemUuid: identity.cycleItemUuid }),
			...(undefined === progress.startedAt ? {} : { startedAt: progress.startedAt }),
			...(undefined === progress.solved ? {} : { solved: progress.solved }),
		};
	}
}
