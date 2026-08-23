import { EntityManager } from '@mikro-orm/core';

import { Puzzle } from '../../puzzle/puzzle.entity';

import { SyncPushOutcome } from './sync-push-outcome';

/**
 * What the seven tables share during a push: the transaction's own `EntityManager` — not a
 * fresh fork, which would fall outside it — the server stamp, the catalogue and the result.
 */
export interface SyncPushContext {
	readonly entityManager: EntityManager;
	readonly receivedAt: Date;
	readonly puzzles: ReadonlyMap<string, Puzzle>;
	readonly outcome: SyncPushOutcome;
}
