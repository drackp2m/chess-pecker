import { EntityManager } from '@mikro-orm/core';

import { Puzzle } from '../../puzzle/puzzle.entity';

import { SyncPushOutcome } from './sync-push-outcome';

/**
 * Lo que las siete tablas comparten mientras dura una subida: el `EntityManager` de *la*
 * transacción —no un fork nuevo, que la dejaría fuera—, la marca de servidor con la que
 * entra todo el árbol de una vez, el catálogo ya resuelto y dónde se apunta el resultado.
 */
export interface SyncPushContext {
	readonly entityManager: EntityManager;
	readonly receivedAt: Date;
	readonly puzzles: ReadonlyMap<string, Puzzle>;
	readonly outcome: SyncPushOutcome;
}
