import { FilterQuery } from '@mikro-orm/core';

import { CustomRepository } from '../../shared/util/custom-entity.repository';
import { shuffle } from '../../shared/util/shuffle.util';

import { Puzzle } from './puzzle.entity';

interface CatalogVersionRow {
	version: Date | string | null;
}

export class PuzzleRepository extends CustomRepository<Puzzle> {
	/**
	 * La importación es un upsert por `lichessId`: reimportar el mismo CSV no duplica y
	 * refresca rating y popularidad, que en Lichess se mueven.
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
	 * La versión del catálogo. La importación es un upsert que refresca rating y popularidad,
	 * así que esta marca se mueve aunque el total no cambie, que es justo lo que hace falta
	 * para que una réplica sepa que se ha quedado vieja.
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
	 * Una muestra de una franja de ELO cerrada por arriba. Lo usan tanto la calibración
	 * (sondeos y rondas de diez) como la selección del set de trabajo.
	 *
	 * La muestra sale de una ventana con desplazamiento aleatorio sobre el orden de `uuid`
	 * —que al ser v4 no guarda relación con nada— en lugar de un `order by random()`, que
	 * obligaría a bajar al QueryBuilder del driver. Así el coste es el del `limit` y no el de
	 * ordenar la tabla entera.
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
