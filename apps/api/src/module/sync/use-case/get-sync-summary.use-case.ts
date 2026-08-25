import type {
	SyncEntity,
	SyncEntitySummary,
	SyncPartialCycle,
	SyncSummary,
} from '@chesspecker/api-definitions';
import { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';

import { GenerateNowDateUseCase } from '../../../shared/use-case/generate-now-date.use-case';
import { SYNC_SCHEMA_VERSION } from '../../../shared/util/sync-schema-version';
import { PuzzleRepository } from '../../puzzle/puzzle.repository';
import { User } from '../../user/user.entity';

/**
 * The user's tree is cut once and the eight branches hang off it: without the `with`, each
 * would repeat the user filter and its parameter eight times over.
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

/**
 * The cycles that did not make it up whole: fewer slots stored than the device declared. A
 * truncated upload leaves them behind, and counting the slots is the only way to see it.
 */
const PARTIAL_CYCLES = `select c.uuid, c.training_uuid as "trainingUuid", c."index",
        c.item_count::int as "itemCount", count(ci.uuid)::int as "storedItems"
 from training_cycle c
 join training t on t.uuid = c.training_uuid
 left join training_cycle_item ci on ci.cycle_uuid = c.uuid
 where t.user_uuid = ?
 group by c.uuid, c.training_uuid, c."index", c.item_count
 having count(ci.uuid) < c.item_count
 order by c.training_uuid, c."index"`;

interface EntitySummaryRow {
	entity: SyncEntity;
	cursor: Date | string | null;
	count: number;
}

/**
 * What is here, in one question: per table, how far the server clock reaches and how many
 * rows there are. The count goes with the stamp because a `MAX` cannot see deletions.
 */
@Injectable()
export class GetSyncSummaryUseCase {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly puzzleRepository: PuzzleRepository,
	) {}

	async execute(user: User): Promise<SyncSummary> {
		const connection = this.entityManager.fork().getConnection();
		const rows = (await connection.execute<EntitySummaryRow[]>(ENTITY_SUMMARY, [
			user.uuid,
		])) as EntitySummaryRow[];
		const partial = (await connection.execute<SyncPartialCycle[]>(PARTIAL_CYCLES, [
			user.uuid,
		])) as SyncPartialCycle[];

		return {
			serverTime: new GenerateNowDateUseCase().execute().toISOString(),
			schemaVersion: SYNC_SCHEMA_VERSION,
			entities: toEntities(rows),
			catalog: {
				version: (await this.puzzleRepository.lastUpdatedAt())?.toISOString() ?? EMPTY_VERSION,
				total: await this.puzzleRepository.countAll(),
			},
			partialCycles: partial,
		};
	}
}

/** An empty catalogue still has a version, so the client compares strings and never nulls. */
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
