import type { SyncEntity, SyncEntitySummary, SyncSummary } from '@chesspecker/api-definitions';
import { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';

import { GenerateNowDateUseCase } from '../../../shared/use-case/generate-now-date.use-case';
import { SYNC_SCHEMA_VERSION } from '../../../shared/util/sync-schema-version';
import { PuzzleRepository } from '../../puzzle/puzzle.repository';
import { User } from '../../user/user.entity';

/**
 * El árbol del usuario se recorta una sola vez y las ocho ramas se cuelgan de él: sin el
 * `with`, cada rama repetiría el filtro por usuario y el parámetro ocho veces.
 */
const ENTITY_SUMMARY = `with owned as (select uuid from training where user_uuid = ?)
 select 'training' as entity, max(t.received_at) as cursor, count(*)::int as count
   from training t join owned o on o.uuid = t.uuid
 union all
 select 'trainingGoal', max(g.received_at), count(*)::int
   from training_goal g join owned o on o.uuid = g.training_uuid
 union all
 select 'calibrationRound', max(r.received_at), count(*)::int
   from training_calibration_round r join owned o on o.uuid = r.training_uuid
 union all
 select 'calibrationPuzzle', max(cp.received_at), count(*)::int
   from training_calibration_puzzle cp
   join training_calibration_round r on r.uuid = cp.calibration_round_uuid
   join owned o on o.uuid = r.training_uuid
 union all
 select 'trainingPuzzle', max(tp.received_at), count(*)::int
   from training_puzzle tp join owned o on o.uuid = tp.training_uuid
 union all
 select 'cycle', max(c.received_at), count(*)::int
   from training_cycle c join owned o on o.uuid = c.training_uuid
 union all
 select 'cycleItem', max(ci.received_at), count(*)::int
   from training_cycle_item ci
   join training_cycle c on c.uuid = ci.cycle_uuid
   join owned o on o.uuid = c.training_uuid
 union all
 select 'attempt', max(pa.received_at), count(*)::int
   from puzzle_attempt pa join owned o on o.uuid = pa.training_uuid`;

interface EntitySummaryRow {
	entity: SyncEntity;
	cursor: Date | string | null;
	count: number;
}

/**
 * Qué hay aquí, en una sola pregunta: por tabla, hasta dónde llega el reloj de servidor y
 * cuántas filas hay. El cliente lo contrasta con sus cursores y sabe qué bajar sin ir tabla
 * a tabla ni entrenamiento a entrenamiento.
 *
 * El recuento acompaña a la marca porque un `MAX` no ve los borrados: sólo cuando las dos
 * cosas coinciden se puede decir que la réplica está al día.
 */
@Injectable()
export class GetSyncSummaryUseCase {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly puzzleRepository: PuzzleRepository,
	) {}

	async execute(user: User): Promise<SyncSummary> {
		const rows = (await this.entityManager
			.fork()
			.getConnection()
			.execute<EntitySummaryRow[]>(ENTITY_SUMMARY, [user.uuid])) as EntitySummaryRow[];

		return {
			serverTime: new GenerateNowDateUseCase().execute().toISOString(),
			schemaVersion: SYNC_SCHEMA_VERSION,
			entities: toEntities(rows),
			catalog: {
				version: (await this.puzzleRepository.lastUpdatedAt())?.toISOString() ?? EMPTY_VERSION,
				total: await this.puzzleRepository.countAll(),
			},
		};
	}
}

/** Un catálogo vacío también tiene versión, para que el cliente compare cadenas y nunca nulos. */
const EMPTY_VERSION = new Date(0).toISOString();

const NOTHING: SyncEntitySummary = { cursor: null, count: 0 };

function toEntities(rows: EntitySummaryRow[]): Record<SyncEntity, SyncEntitySummary> {
	const entities: Record<SyncEntity, SyncEntitySummary> = {
		training: NOTHING,
		trainingGoal: NOTHING,
		calibrationRound: NOTHING,
		calibrationPuzzle: NOTHING,
		trainingPuzzle: NOTHING,
		cycle: NOTHING,
		cycleItem: NOTHING,
		attempt: NOTHING,
	};

	for (const row of rows) {
		entities[row.entity] = { cursor: toIso(row.cursor), count: row.count };
	}

	return entities;
}

function toIso(cursor: Date | string | null): string | null {
	return null === cursor ? null : new Date(cursor).toISOString();
}
