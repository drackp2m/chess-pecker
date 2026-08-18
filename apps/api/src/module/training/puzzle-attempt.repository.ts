import { CustomRepository } from '../../shared/util/custom-entity.repository';

import { PuzzleAttemptKind } from './definition/puzzle-attempt-kind.enum';
import { TrainingActivityDay } from './definition/training-activity.interface';
import { PuzzleAttempt } from './puzzle-attempt.entity';

const ACTIVITY_BY_DAY = `select to_char(pa.updated_at, 'YYYY-MM-DD') as date,
        count(*)::int as count,
        count(*) filter (where pa.solved)::int as solved,
        count(*) filter (where not pa.solved and pa.closure <> 'revealed')::int as failed,
        count(*) filter (where not pa.solved and pa.closure = 'revealed')::int as resigned,
        count(*) filter (where pa.closure = 'found' and not pa.hint_used and pa.mistake_count = 0)::int as "foundClean",
        count(*) filter (where pa.closure = 'found' and pa.hint_used and pa.mistake_count = 0)::int as "foundHinted",
        count(*) filter (where pa.closure = 'found' and not pa.hint_used and pa.mistake_count > 0)::int as "foundMissed",
        count(*) filter (where pa.closure = 'found' and pa.hint_used and pa.mistake_count > 0)::int as "foundMissedHinted",
        count(*) filter (where pa.closure = 'revealed' and not pa.hint_used)::int as revealed,
        count(*) filter (where pa.closure = 'revealed' and pa.hint_used)::int as "revealedHinted",
        coalesce(sum(pa.mistake_count), 0)::int as mistakes,
        count(*) filter (where pa.hint_used)::int as hints,
        coalesce(sum(pa.duration_ms), 0)::int as "durationMs"
 from puzzle_attempt pa
 join training t on t.uuid = pa.training_uuid
 where t.user_uuid = ? and pa.updated_at >= ?
 group by to_char(pa.updated_at, 'YYYY-MM-DD')`;

const RECEIVED_AFTER = 'having max(pa.received_at) > ?';

const PAGE_SELECT = `select pa.uuid
 from puzzle_attempt pa
 where pa.training_uuid = ?`;

const PAGE_AFTER = `and (pa.received_at, pa.uuid) > (
   select anchor.received_at, anchor.uuid from puzzle_attempt anchor where anchor.uuid = ?
 )`;

const PAGE_ORDER = 'order by pa.received_at asc, pa.uuid asc limit ?';

interface CursorRow {
	cursor: Date | string | null;
}

interface UuidRow {
	uuid: string;
}

export class PuzzleAttemptRepository extends CustomRepository<PuzzleAttempt> {
	async getManyByCalibrationRound(roundUuid: string): Promise<PuzzleAttempt[]> {
		return this.getMany({ calibrationRound: roundUuid });
	}

	async getManyByCycle(cycleUuid: string): Promise<PuzzleAttempt[]> {
		return this.getMany(
			{ kind: PuzzleAttemptKind.Cycle, cycleItem: { cycle: cycleUuid } },
			{ populate: ['cycleItem'] },
		);
	}

	async getManyByTraining(trainingUuid: string): Promise<PuzzleAttempt[]> {
		return this.getMany({ training: trainingUuid });
	}

	async getPageByTraining(
		trainingUuid: string,
		limit: number,
		after?: string,
	): Promise<PuzzleAttempt[]> {
		const anchor = undefined === after ? undefined : await this.anchorOf(trainingUuid, after);
		const uuids = await this.pageUuids(trainingUuid, limit, anchor);

		if (0 === uuids.length) {
			return [];
		}

		return this.getMany(
			{ uuid: { $in: uuids } },
			{
				populate: ['puzzle', 'calibrationRound', 'cycleItem'],
				orderBy: { receivedAt: 'asc', uuid: 'asc' },
			},
		);
	}

	async countByDaySince(
		userUuid: string,
		since: Date,
		receivedAfter?: Date,
	): Promise<TrainingActivityDay[]> {
		const having = undefined === receivedAfter ? '' : RECEIVED_AFTER;
		const params: unknown[] = [userUuid, since];

		if (undefined !== receivedAfter) {
			params.push(receivedAfter);
		}

		return (await this.entityManager
			.fork()
			.getConnection()
			.execute<TrainingActivityDay[]>(
				`${ACTIVITY_BY_DAY} ${having} order by date`,
				params,
			)) as TrainingActivityDay[];
	}

	async lastReceivedAt(userUuid: string): Promise<Date | null> {
		const rows = (await this.entityManager
			.fork()
			.getConnection()
			.execute<CursorRow[]>(
				`select max(pa.received_at) as cursor
				 from puzzle_attempt pa
				 join training t on t.uuid = pa.training_uuid
				 where t.user_uuid = ?`,
				[userUuid],
			)) as CursorRow[];

		const cursor = rows[0]?.cursor ?? null;

		return null === cursor ? null : new Date(cursor);
	}

	private async anchorOf(trainingUuid: string, uuid: string): Promise<string | undefined> {
		const rows = (await this.entityManager
			.fork()
			.getConnection()
			.execute<UuidRow[]>(
				`select pa.uuid
				 from puzzle_attempt pa
				 where pa.uuid = ? and pa.training_uuid = ?`,
				[uuid, trainingUuid],
			)) as UuidRow[];

		return rows[0]?.uuid;
	}

	private async pageUuids(trainingUuid: string, limit: number, after?: string): Promise<string[]> {
		const rows = (await this.entityManager
			.fork()
			.getConnection()
			.execute<UuidRow[]>(
				`${PAGE_SELECT} ${undefined === after ? '' : PAGE_AFTER} ${PAGE_ORDER}`,
				undefined === after ? [trainingUuid, limit] : [trainingUuid, after, limit],
			)) as UuidRow[];

		return rows.map((row) => row.uuid);
	}
}
