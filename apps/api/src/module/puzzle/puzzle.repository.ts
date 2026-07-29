import { FilterQuery } from '@mikro-orm/core';

import { CustomRepository } from '../../shared/util/custom-entity.repository';

import { Puzzle } from './puzzle.entity';

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

		// eslint-disable-next-line sonarjs/pseudo-random -- elegir ejercicios no es una decisión de seguridad
		const offset = Math.floor(Math.random() * Math.max(1, total - limit + 1));

		const puzzles = await this.getMany(query, { limit, offset, orderBy: { uuid: 'asc' } });

		return shuffle(puzzles);
	}
}

const shuffle = (puzzles: Puzzle[]): Puzzle[] => {
	const shuffled = [...puzzles];

	for (let index = shuffled.length - 1; 0 < index; index--) {
		// eslint-disable-next-line sonarjs/pseudo-random -- barajar ejercicios no es una decisión de seguridad
		const target = Math.floor(Math.random() * (index + 1));

		[shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
	}

	return shuffled;
};
