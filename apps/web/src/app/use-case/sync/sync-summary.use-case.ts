import { Injectable, inject } from '@angular/core';
import type { SyncEntity, SyncEntitySummary, SyncSummary } from '@chesspecker/api-definitions';

import { SYNC_ENTITIES } from '@app/definition/sync-entity.constant';
import { SYNC_SCHEMA_VERSION } from '@app/definition/sync-schema.constant';
import { SyncCursorRow } from '@app/repository/definition/sync-cursor-schema.interface';
import { SyncCursorRepository } from '@app/repository/sync-cursor.repository';
import { SyncRepository } from '@app/repository/sync.repository';

export interface SyncStatus {
	readonly summary: SyncSummary;
	/** El servidor corre un modelo más nuevo que éste: se baja, pero no se sube. */
	readonly canPush: boolean;
	/** Las tablas cuyo cursor local se ha quedado por detrás del servidor. */
	readonly behind: readonly SyncEntity[];
}

/**
 * Lo que hay del otro lado contrastado con lo que hay aquí, en una sola llamada. Es la fase
 * de `checking` del ciclo: quien la lee sabe si puede subir y qué le falta por bajar sin
 * haber preguntado tabla a tabla ni entrenamiento a entrenamiento.
 */
@Injectable({
	providedIn: 'root',
})
export class SyncSummaryUseCase {
	private readonly remote = inject(SyncRepository);
	private readonly cursors = inject(SyncCursorRepository);

	async read(): Promise<SyncStatus> {
		const summary = await this.remote.getSummary();
		const stored = new Map((await this.cursors.findAllCursors()).map((row) => [row.key, row]));

		return {
			summary,
			canPush: summary.schemaVersion <= SYNC_SCHEMA_VERSION,
			behind: SYNC_ENTITIES.filter((entity) =>
				isBehind(stored.get(entity), summary.entities[entity]),
			),
		};
	}
}

/**
 * Marca y recuento iguales es «al día». La marca sola no bastaría: un `MAX` no ve un borrado,
 * y el recuento solo tampoco, porque una fila sustituida por otra deja el total igual.
 */
function isBehind(local: SyncCursorRow | undefined, remote: SyncEntitySummary): boolean {
	if (null === remote.cursor && 0 === remote.count) {
		return false;
	}

	return (local?.cursor ?? null) !== remote.cursor || (local?.count ?? 0) !== remote.count;
}
