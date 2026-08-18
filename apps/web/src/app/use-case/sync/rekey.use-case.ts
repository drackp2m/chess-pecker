import { Injectable, inject } from '@angular/core';
import type { PushTrainingResult, SyncEntity } from '@chesspecker/api-definitions';
import { DBSchema, IDBPObjectStore, StoreNames } from 'idb';

import { SYNC_ENTITIES } from '@app/definition/sync-entity.constant';
import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { AttemptDraftRow } from '@app/repository/definition/attempt-draft-schema.interface';
import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { RepositoryTransaction } from '@app/repository/generic.repository';
import { LocalDataRepository } from '@app/repository/local-data.repository';
import { toSlotId } from '@app/use-case/attempt-draft.use-case';

type Remap = Record<SyncEntity, Map<string, string>>;

type RekeyTransaction = RepositoryTransaction<AppSchema, 'readwrite'>;

/** Una fila sincronizable vista sólo por su clave, que es lo único que el reclavado toca. */
interface RekeyableRow {
	readonly uuid: string;
}

interface RekeyableSchema extends DBSchema {
	row: { key: string; value: RekeyableRow };
}

type RekeyableStore = IDBPObjectStore<RekeyableSchema, ['row'], 'row', 'readwrite'>;

/** El borrador entra aunque nunca suba: su clave es el hueco, y el hueco se mueve. */
const REKEY_STORES: StoreNames<AppSchema>[] = [...SYNC_ENTITIES, 'attemptDraft'];

/**
 * Clavar el árbol local con los uuid que devolvió la subida.
 *
 * Una clave primaria no se edita, así que reclavar es borrar y volver a insertar; y la fila
 * no viaja sola, porque sus hijos la nombran. Todo ocurre en una única transacción de
 * IndexedDB: o el árbol entero queda con los uuid del servidor, o sigue con los suyos. Un
 * árbol a medio reescribir sería historial corrompido en silencio.
 *
 * `clientRef` no se toca nunca: es con lo que nació la fila y con lo que se reintenta.
 */
@Injectable({
	providedIn: 'root',
})
export class RekeyUseCase {
	private readonly repository = inject(LocalDataRepository);

	async execute(trainingUuid: string, uuids: PushTrainingResult['uuids']): Promise<void> {
		const remap = toRemap(uuids);

		if (isEmpty(remap)) {
			return;
		}

		await this.repository.runInTransaction(REKEY_STORES, 'readwrite', async (transaction) => {
			// Las referencias primero: mientras los padres conservan su clave vieja, los hijos
			// se encuentran por índice.
			await rewriteReferences(transaction, trainingUuid, remap);
			await rekeyRows(transaction, remap);
		});
	}
}

/** El uuid que devolvió el servidor sólo interesa si no es el que la fila ya tenía. */
function toRemap(uuids: PushTrainingResult['uuids']): Remap {
	const remap: Remap = {
		training: new Map(),
		trainingGoal: new Map(),
		calibrationRound: new Map(),
		calibrationPuzzle: new Map(),
		trainingPuzzle: new Map(),
		cycle: new Map(),
		cycleItem: new Map(),
		attempt: new Map(),
	};

	for (const entity of SYNC_ENTITIES) {
		for (const [clientRef, uuid] of Object.entries(uuids[entity])) {
			if (clientRef !== uuid) {
				remap[entity].set(clientRef, uuid);
			}
		}
	}

	return remap;
}

function isEmpty(remap: Remap): boolean {
	return Object.values(remap).every((assigned) => 0 === assigned.size);
}

async function rewriteReferences(
	transaction: RekeyTransaction,
	trainingUuid: string,
	remap: Remap,
): Promise<void> {
	const trainingRef = remap.training.get(trainingUuid) ?? trainingUuid;

	await rewriteGoals(transaction, trainingUuid, trainingRef);
	await rewriteSet(transaction, trainingUuid, trainingRef);
	await rewriteRounds(transaction, trainingUuid, trainingRef, remap);
	await rewriteCycles(transaction, trainingUuid, trainingRef, remap);
	await rewriteAttempts(transaction, trainingUuid, trainingRef, remap);
	await rewriteDrafts(transaction, trainingUuid, trainingRef, remap);
}

async function rewriteGoals(
	transaction: RekeyTransaction,
	trainingUuid: string,
	trainingRef: string,
): Promise<void> {
	const store = transaction.objectStore('trainingGoal');

	for (const row of await store.index('trainingUuid').getAll(trainingUuid)) {
		await store.put({ ...row, trainingUuid: trainingRef });
	}
}

async function rewriteSet(
	transaction: RekeyTransaction,
	trainingUuid: string,
	trainingRef: string,
): Promise<void> {
	const store = transaction.objectStore('trainingPuzzle');

	for (const row of await store.index('trainingUuid').getAll(trainingUuid)) {
		await store.put({ ...row, trainingUuid: trainingRef });
	}
}

async function rewriteRounds(
	transaction: RekeyTransaction,
	trainingUuid: string,
	trainingRef: string,
	remap: Remap,
): Promise<void> {
	const store = transaction.objectStore('calibrationRound');

	for (const row of await store.index('trainingUuid').getAll(trainingUuid)) {
		await store.put({ ...row, trainingUuid: trainingRef });
		await rewriteDealt(transaction, row.uuid, remap.calibrationRound.get(row.uuid) ?? row.uuid);
	}
}

/** Lo que repartió la ronda: la nombra por su clave, así que la sigue. */
async function rewriteDealt(
	transaction: RekeyTransaction,
	roundUuid: string,
	roundRef: string,
): Promise<void> {
	if (roundRef === roundUuid) {
		return;
	}

	const store = transaction.objectStore('calibrationPuzzle');

	for (const row of await store.index('roundUuid').getAll(roundUuid)) {
		await store.put({ ...row, roundUuid: roundRef });
	}
}

async function rewriteCycles(
	transaction: RekeyTransaction,
	trainingUuid: string,
	trainingRef: string,
	remap: Remap,
): Promise<void> {
	const store = transaction.objectStore('cycle');

	for (const row of await store.index('trainingUuid').getAll(trainingUuid)) {
		await store.put({ ...row, trainingUuid: trainingRef });
		await rewriteItems(transaction, row.uuid, remap.cycle.get(row.uuid) ?? row.uuid, remap);
	}
}

/** El hueco nombra a su ciclo y al ejercicio del set: los dos pueden haberse movido. */
async function rewriteItems(
	transaction: RekeyTransaction,
	cycleUuid: string,
	cycleRef: string,
	remap: Remap,
): Promise<void> {
	const store = transaction.objectStore('cycleItem');

	for (const row of await store.index('cycleUuid').getAll(cycleUuid)) {
		const trainingPuzzleUuid =
			remap.trainingPuzzle.get(row.trainingPuzzleUuid) ?? row.trainingPuzzleUuid;

		await store.put({ ...row, cycleUuid: cycleRef, trainingPuzzleUuid });
	}
}

async function rewriteAttempts(
	transaction: RekeyTransaction,
	trainingUuid: string,
	trainingRef: string,
	remap: Remap,
): Promise<void> {
	const store = transaction.objectStore('attempt');

	for (const row of await store.index('trainingUuid').getAll(trainingUuid)) {
		await store.put(withAttemptParents(row, trainingRef, remap));
	}
}

/**
 * El borrador no sube, pero su clave primaria *es* el hueco que ocupa: si el hueco cambia de
 * uuid y el borrador se queda con el viejo, el ejercicio a medias deja de encontrarse.
 */
async function rewriteDrafts(
	transaction: RekeyTransaction,
	trainingUuid: string,
	trainingRef: string,
	remap: Remap,
): Promise<void> {
	const store = transaction.objectStore('attemptDraft');

	for (const row of await store.getAll()) {
		if (row.trainingUuid !== trainingUuid) {
			continue;
		}

		const moved = withDraftParents(row, trainingRef, remap);

		if (moved.slotId !== row.slotId) {
			await store.delete(row.slotId);
		}

		await store.put(moved);
	}
}

function withAttemptParents(row: AttemptRow, trainingUuid: string, remap: Remap): AttemptRow {
	return {
		...row,
		trainingUuid,
		...(undefined === row.roundUuid
			? {}
			: { roundUuid: remap.calibrationRound.get(row.roundUuid) ?? row.roundUuid }),
		...(undefined === row.cycleItemUuid
			? {}
			: { cycleItemUuid: remap.cycleItem.get(row.cycleItemUuid) ?? row.cycleItemUuid }),
	};
}

function withDraftParents(
	row: AttemptDraftRow,
	trainingUuid: string,
	remap: Remap,
): AttemptDraftRow {
	const moved: AttemptDraftRow = {
		...row,
		trainingUuid,
		...(undefined === row.roundUuid
			? {}
			: { roundUuid: remap.calibrationRound.get(row.roundUuid) ?? row.roundUuid }),
		...(undefined === row.cycleItemUuid
			? {}
			: { cycleItemUuid: remap.cycleItem.get(row.cycleItemUuid) ?? row.cycleItemUuid }),
	};

	return { ...moved, slotId: toSlotId(moved) };
}

async function rekeyRows(transaction: RekeyTransaction, remap: Remap): Promise<void> {
	for (const entity of SYNC_ENTITIES) {
		await rekeyStore(transaction, entity, remap[entity]);
	}
}

/**
 * Reclavar es borrar la clave vieja e insertar con la nueva, y de la fila no hace falta ver
 * nada más que su uuid. `objectStore` es genérico y una unión de firmas genéricas no se
 * puede llamar, así que la vista estructural es lo que permite escribir esto una vez en vez
 * de ocho.
 */
async function rekeyStore(
	transaction: RekeyTransaction,
	entity: SyncEntity,
	assigned: Map<string, string>,
): Promise<void> {
	const store = transaction.objectStore(entity) as unknown as RekeyableStore;

	for (const [key, uuid] of assigned) {
		const row = await store.get(key);

		if (undefined !== row) {
			await store.delete(key);
			await store.put({ ...row, uuid });
		}
	}
}
