import { Injectable } from '@angular/core';

import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { PuzzleRow } from '@app/repository/definition/puzzle-schema.interface';
import { GenericRepository } from '@app/repository/generic.repository';
import { shuffle } from '@app/util/shuffle';

@Injectable({
	providedIn: 'root',
})
export class TrainingLocalRepository extends GenericRepository<AppSchema> {
	async countByRating(ratingMin: number, ratingMax: number): Promise<number> {
		return this.runInTransaction(['puzzle'], 'readonly', (transaction) =>
			transaction
				.objectStore('puzzle')
				.index('rating')
				.count(IDBKeyRange.bound(ratingMin, ratingMax)),
		);
	}

	async sampleCatalogByRating(
		ratingMin: number,
		ratingMax: number,
		limit: number,
	): Promise<PuzzleRow[]> {
		if (0 >= limit) {
			return [];
		}

		const rows = await this.runInTransaction(['puzzle'], 'readonly', (transaction) =>
			transaction
				.objectStore('puzzle')
				.index('rating')
				.getAll(IDBKeyRange.bound(ratingMin, ratingMax)),
		);

		return shuffle(rows.filter((row) => undefined !== row.uuid)).slice(0, limit);
	}

	async findPuzzles(lichessIds: readonly string[]): Promise<PuzzleRow[]> {
		const rows = await this.runInTransaction(['puzzle'], 'readonly', (transaction) => {
			const store = transaction.objectStore('puzzle');

			return Promise.all(lichessIds.map((lichessId) => store.get(lichessId)));
		});

		return rows.filter((row): row is PuzzleRow => undefined !== row);
	}
}
