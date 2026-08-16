import type { SyncEntity, SyncNode } from '@chesspecker/api-definitions';

import { SYNC_ENTITIES } from '@app/definition/sync-entity.constant';
import { SyncPolicy } from '@app/definition/sync-policy.constant';
import { SyncableRow } from '@app/use-case/sync/local-record';

/**
 * Qué filas espera confirmar una subida, por entidad y por el uuid que tienen aquí. La
 * respuesta sólo sabe nombrar las que nacieron en este dispositivo, así que sin esta lista
 * no habría forma de sellar una fila que bajó del servidor y se tocó después.
 */
export type SyncManifest = Record<SyncEntity, readonly string[]>;

/**
 * Lo que el árbol se compromete a subir en esta petición. Va con presupuesto: el árbol
 * entero de una cuenta veterana no cabe en una sola llamada, y lo que se queda fuera sube en
 * la pasada siguiente sin que nada se duplique.
 */
export class SyncManifestBuilder {
	private readonly rows: Record<SyncEntity, string[]> = {
		training: [],
		trainingGoal: [],
		calibrationRound: [],
		calibrationPuzzle: [],
		trainingPuzzle: [],
		cycle: [],
		cycleItem: [],
		attempt: [],
	};

	private budget: number = SyncPolicy.pushBatchSize;

	/** Cuántas filas hay que confirmar cuando el servidor conteste. */
	get pending(): number {
		return SYNC_ENTITIES.reduce((total, entity) => total + this.rows[entity].length, 0);
	}

	/**
	 * `false` cuando la fila no cabe, y entonces tampoco viaja lo que cuelga de ella: sin su
	 * padre, un hijo no se puede nombrar. Una fila ya sellada no gasta presupuesto —viaja
	 * sólo para dar padre a los suyos— así que siempre entra.
	 */
	add(entity: SyncEntity, row: SyncableRow): boolean {
		if (undefined === row.pendingSince) {
			return true;
		}

		if (0 === this.budget) {
			return false;
		}

		this.budget -= 1;
		this.rows[entity].push(row.uuid);

		return true;
	}

	build(): SyncManifest {
		return this.rows;
	}
}

/**
 * Cómo se nombra una fila en el árbol. El uuid sólo cuando ya subió, porque el de una que no
 * lo ha hecho es local y el servidor no lo conoce; la clave de reintento, siempre que la
 * tenga.
 */
export function syncNode(row: SyncableRow): SyncNode {
	return { ...syncNames(row), ...syncDates(row) };
}

/** Con qué la nombran las filas que cuelgan de ella y no la contienen. */
export function syncRef(row: SyncableRow): string {
	return undefined === row.syncedAt ? (row.clientRef ?? row.uuid) : row.uuid;
}

function syncNames(row: SyncableRow): SyncNode {
	if (undefined === row.syncedAt) {
		return { clientRef: row.clientRef ?? row.uuid };
	}

	return {
		uuid: row.uuid,
		...(undefined === row.clientRef ? {} : { clientRef: row.clientRef }),
	};
}

function syncDates(row: SyncableRow): SyncNode {
	return {
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}
