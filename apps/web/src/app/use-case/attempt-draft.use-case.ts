import { Injectable, inject } from '@angular/core';
import type { PuzzleAttemptKind } from '@chesspecker/api-definitions';

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
	/** Su sitio en la pasada, para que la fila sepa nombrarlo sin el plan delante. */
	readonly position?: number;
}

export interface AttemptProgress extends PuzzleRecord {
	readonly durationMs: number;
	readonly updatedAt: Date;
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

	/**
	 * El intento ya está en el servidor, así que la copia local deja de ser la única.
	 * Sin este sello no habría manera de saber qué se perdería al vaciar el dispositivo.
	 */
	async markSynced(draft: AttemptDraft, syncedAt: Date = new Date()): Promise<void> {
		const row = await this.find(draft.identity);

		if (undefined !== row) {
			await this.repository.insert('attempt', { ...row, syncedAt });
		}
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
			closure: progress.closure,
			hintUsed: progress.hintUsed,
			mistakeCount: progress.mistakeCount,
			createdAt: draft.createdAt,
			updatedAt: progress.updatedAt,
			...(undefined === draft.position ? {} : { position: draft.position }),
			...(undefined === identity.roundUuid ? {} : { roundUuid: identity.roundUuid }),
			...(undefined === identity.cycleItemUuid ? {} : { cycleItemUuid: identity.cycleItemUuid }),
			...(undefined === progress.startedAt ? {} : { startedAt: progress.startedAt }),
			...(undefined === progress.solved ? {} : { solved: progress.solved }),
		};
	}
}
