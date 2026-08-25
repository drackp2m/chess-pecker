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
 * The cycles that did not make it up whole: fewer slots stored than they should hold. Every
 * cycle walks the whole set, so the set is the floor no truncated upload can lower — the
 * count the cycle declares only ever raises it.
 */
const PARTIAL_CYCLES = `with declared as (
   select c.uuid, c.training_uuid, c."index",
          greatest(c.item_count, (select count(*)::int from training_puzzle tp
                                   where tp.training_uuid = c.training_uuid))::int as item_count
     from training_cycle c
     join training t on t.uuid = c.training_uuid
    where t.user_uuid = ?
 )
 select d.uuid, d.training_uuid as "trainingUuid", d."index",
        d.item_count as "itemCount", count(ci.uuid)::int as "storedItems"
 from declared d
 left join training_cycle_item ci on ci.cycle_uuid = d.uuid
 group by d.uuid, d.training_uuid, d."index", d.item_count
 having count(ci.uuid) < d.item_count
 order by d.training_uuid, d."index"`;

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
