import { FilterQuery } from '@mikro-orm/core';

import { CustomRepository } from '../../shared/util/custom-entity.repository';
import { shuffle } from '../../shared/util/shuffle.util';

import { Puzzle } from './puzzle.entity';

interface CatalogVersionRow {
	version: Date | string | null;
}

export class PuzzleRepository extends CustomRepository<Puzzle> {
	/**
	 * The import upserts on `lichessId`, so re-importing the same CSV duplicates nothing and
	 * refreshes rating and popularity, both of which move on Lichess.
	 */
	async upsertManyByLichessId(puzzles: Puzzle[]): Promise<Puzzle[]> {
		if (0 === puzzles.length) {
			return [];
		}

		return this.entityManager.fork().upsertMany(Puzzle, puzzles, {
			onConflictFields: ['lichessId'],
		});
	}

	async getManyAfterLichessId(limit: number, after?: string): Promise<Puzzle[]> {
		const query: FilterQuery<Puzzle> = undefined === after ? {} : { lichessId: { $gt: after } };

		return this.getMany(query, { limit, orderBy: { lichessId: 'asc' } });
	}

	async countAll(): Promise<number> {
		return this.entityManager.fork().count(Puzzle, {});
	}

	/**
	 * The catalogue version. The import upserts rating and popularity, so this moves even when
	 * the total does not, which is how a replica learns it has gone stale.
	 */
	async lastUpdatedAt(): Promise<Date | null> {
		const rows = (await this.entityManager
			.fork()
			.getConnection()
			.execute<CatalogVersionRow[]>(
				'select max(p.updated_at) as version from puzzle p',
			)) as CatalogVersionRow[];

		const version = rows[0]?.version ?? null;

		return null === version ? null : new Date(version);
	}

	/**
	 * A sample of an ELO band, drawn through a randomly offset window over `uuid` order rather
	 * than `order by random()`: the cost is the `limit` and not sorting the whole table.
	 */
	async getManyRandomByRating(
		ratingMin: number,
		ratingMax: number,
		limit: number,
	): Promise<Puzzle[]> {
		const query: FilterQuery<Puzzle> = { rating: { $gte: ratingMin, $lte: ratingMax } };

		const total = await this.entityManager.fork().count(Puzzle, query);

		if (0 === total) {
			return [];
		}

		const offset = Math.floor(Math.random() * Math.max(1, total - limit + 1));

		const puzzles = await this.getMany(query, { limit, offset, orderBy: { uuid: 'asc' } });

		return shuffle(puzzles);
	}
}
