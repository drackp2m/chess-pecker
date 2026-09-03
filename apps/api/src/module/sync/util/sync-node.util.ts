import type {
	PushTrainingNodeParsed,
	SyncEntity,
	SyncNodeParsed,
} from '@chesspecker/api-definitions';
import { EntityManager } from '@mikro-orm/core';

import { BadRequestException } from '../../../shared/exception/bad-request.exception';
import { Puzzle } from '../../puzzle/puzzle.entity';
import { SyncPushContext } from '../definition/sync-push-context.interface';

export type SyncKey = { uuid: string } | { clientRef: string };

/**
 * How a row is looked up before insert: the uuid when it comes, since it means the row
 * already went up, and the retry key otherwise. That lookup is the whole idempotency.
 */
export function syncKey(node: SyncNodeParsed, entity: SyncEntity): SyncKey {
	const uuid = node.uuid ?? undefined;
	const clientRef = node.clientRef ?? undefined;

	if (undefined !== uuid) {
		return { uuid };
	}

	if (undefined !== clientRef) {
		return { clientRef };
	}

	throw new BadRequestException('clientRef or uuid is required', entity);
}

/**
 * Whether what arrives is newer than what is stored. Three rows change state after birth,
 * so local wins — but only forwards: a late push never rewinds what is already there.
 */
export function isFresherNode(node: SyncNodeParsed, row: { updatedAt: Date }): boolean {
	const updatedAt = node.updatedAt ?? undefined;

	return undefined !== updatedAt && updatedAt.getTime() > row.updatedAt.getTime();
}

/**
 * A row that was already there, returned untouched — unless it hangs off another parent,
 * which is two devices colliding: the first keeps the slot and the second is refused.
 */
export function reuseSyncRow<T extends { uuid: string }>(
	context: SyncPushContext,
	entity: SyncEntity,
	node: SyncNodeParsed,
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
 * A new row: it keeps the retry key it arrived with and this push's server stamp, and its
 * final uuid travels back so the device can rekey.
 */
export function claimSyncRow<T extends { uuid: string; receivedAt: Date; clientRef?: string }>(
	context: SyncPushContext,
	entity: SyncEntity,
	node: SyncNodeParsed,
	row: T,
): T {
	const clientRef = node.clientRef ?? undefined;

	if (undefined !== clientRef) {
		row.clientRef = clientRef;
	}

	row.receivedAt = context.receivedAt;

	context.entityManager.persist(row);
	context.outcome.keep(entity, node, row.uuid);

	return row;
}

/** The catalogue needed to translate the whole tree, in one query. */
export async function loadTreePuzzles(
	entityManager: EntityManager,
	node: PushTrainingNodeParsed,
): Promise<Map<string, Puzzle>> {
	const lichessIds = [...collectLichessIds(node)];

	if (0 === lichessIds.length) {
		return new Map();
	}

	const puzzles = await entityManager.find(Puzzle, { lichessId: { $in: lichessIds } });

	return new Map(puzzles.map((puzzle) => [puzzle.lichessId, puzzle]));
}

function collectLichessIds(node: PushTrainingNodeParsed): Set<string> {
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
