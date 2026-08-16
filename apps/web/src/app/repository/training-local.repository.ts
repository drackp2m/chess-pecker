import { Injectable } from '@angular/core';

import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { PuzzleRow } from '@app/repository/definition/puzzle-schema.interface';
import { GenericRepository } from '@app/repository/generic.repository';
import { Generate } from '@app/util/generate';

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

	async sampleByRating(ratingMin: number, ratingMax: number, limit: number): Promise<PuzzleRow[]> {
		if (0 >= limit) {
			return [];
		}

		return this.runInTransaction(['puzzle'], 'readonly', async (transaction) => {
			const index = transaction.objectStore('puzzle').index('rating');
			const range = IDBKeyRange.bound(ratingMin, ratingMax);
			const total = await index.count(range);

			if (0 === total) {
				return [];
			}

			const offset = Generate.randomNumber(0, Math.max(0, total - limit));
			const rows: PuzzleRow[] = [];

			let cursor = await index.openCursor(range);

			if (null !== cursor && 0 < offset) {
				cursor = await cursor.advance(offset);
			}

			while (null !== cursor && rows.length < limit) {
				rows.push(cursor.value);
				cursor = await cursor.continue();
			}

			return rows;
		});
	}
}
