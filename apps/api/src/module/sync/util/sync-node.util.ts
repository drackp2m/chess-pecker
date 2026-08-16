import type { SyncEntity } from '@chesspecker/api-definitions';
import { EntityManager } from '@mikro-orm/core';

import { BadRequestException } from '../../../shared/exception/bad-request.exception';
import { Puzzle } from '../../puzzle/puzzle.entity';
import { SyncPushContext } from '../definition/sync-push-context.interface';
import { PushTrainingNodeDto } from '../dto/request/push-training-node.dto';
import { SyncNodeDto } from '../dto/request/sync-node.dto';

export type SyncKey = { uuid: string } | { clientRef: string };

/**
 * Con qué se busca una fila antes de insertarla. El uuid manda cuando viene, porque
 * significa que esa fila ya subió; si no, la clave de reintento. Esa búsqueda es toda la
 * idempotencia de la subida.
 */
export function syncKey(node: SyncNodeDto, entity: SyncEntity): SyncKey {
	if (undefined !== node.uuid) {
		return { uuid: node.uuid };
	}

	if (undefined !== node.clientRef) {
		return { clientRef: node.clientRef };
	}

	throw new BadRequestException('clientRef or uuid is required', entity);
}

/**
 * Una fila que ya estaba. Se devuelve tal cual —la subida no pisa lo que hay— salvo que
 * cuelgue de otro padre, y entonces es el choque de dos dispositivos sobre el mismo hueco:
 * se queda el primero y el segundo se marca como rechazado para que deje de reintentarse.
 */
export function reuseSyncRow<T extends { uuid: string }>(
	context: SyncPushContext,
	entity: SyncEntity,
	node: SyncNodeDto,
	row: T,
	belongsHere: boolean,
	reason: string,
): T | undefined {
	if (!belongsHere) {
		context.outcome.reject(entity, node, reason);

		return undefined;
	}

	context.outcome.keep(entity, node, row.uuid);

	return row;
}

/**
 * Una fila nueva: se queda con la clave de reintento que traía, con la marca de servidor de
 * esta subida, y su uuid definitivo sale de vuelta para que el dispositivo se reclave.
 */
export function claimSyncRow<T extends { uuid: string; receivedAt: Date; clientRef?: string }>(
	context: SyncPushContext,
	entity: SyncEntity,
	node: SyncNodeDto,
	row: T,
): T {
	if (undefined !== node.clientRef) {
		row.clientRef = node.clientRef;
	}

	row.receivedAt = context.receivedAt;

	context.entityManager.persist(row);
	context.outcome.keep(entity, node, row.uuid);

	return row;
}

/** El catálogo que hace falta para traducir el árbol entero, en una sola consulta. */
export async function loadTreePuzzles(
	entityManager: EntityManager,
	node: PushTrainingNodeDto,
): Promise<Map<string, Puzzle>> {
	const lichessIds = [...collectLichessIds(node)];

	if (0 === lichessIds.length) {
		return new Map();
	}

	const puzzles = await entityManager.find(Puzzle, { lichessId: { $in: lichessIds } });

	return new Map(puzzles.map((puzzle) => [puzzle.lichessId, puzzle]));
}

function collectLichessIds(node: PushTrainingNodeDto): Set<string> {
	const lichessIds = new Set(node.puzzles.map((puzzle) => puzzle.lichessId));

	for (const round of node.rounds) {
		for (const dealt of round.puzzles) {
			lichessIds.add(dealt.lichessId);
		}

		for (const attempt of round.attempts) {
			lichessIds.add(attempt.lichessId);
		}
	}

	for (const cycle of node.cycles) {
		for (const item of cycle.items) {
			for (const attempt of item.attempts) {
				lichessIds.add(attempt.lichessId);
			}
		}
	}

	return lichessIds;
}
