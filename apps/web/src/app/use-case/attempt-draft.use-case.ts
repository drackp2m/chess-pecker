import { Injectable, inject } from '@angular/core';
import type { PuzzleAttemptClosure, PuzzleAttemptKind } from '@chesspecker/api-definitions';

import { PuzzleRecord } from '@app/definition/puzzle.type';
import { AttemptRepository } from '@app/repository/attempt.repository';
import { AttemptDraftRow } from '@app/repository/definition/attempt-draft-schema.interface';
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
	 * El hueco que el intento ocupa, que es por lo que se le reconoce: el uuid lo pone cada
	 * lado por su cuenta, así que casar por él duplicaría lo que ya está aquí.
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
	 * Cerrar un ejercicio es una sola transacción: el intento entra y el borrador se va, así
	 * que no hay instante en el que el mismo hueco esté en los dos sitios ni en ninguno.
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

		return {
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
			clientRef: draft.uuid,
			pendingSince: outcome.updatedAt,
			...(undefined === draft.position ? {} : { position: draft.position }),
			...(undefined === identity.roundUuid ? {} : { roundUuid: identity.roundUuid }),
			...(undefined === identity.cycleItemUuid ? {} : { cycleItemUuid: identity.cycleItemUuid }),
		};
	}
}
