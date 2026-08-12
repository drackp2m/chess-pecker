import { Injectable, inject } from '@angular/core';
import type { ApiPuzzle } from '@chesspecker/api-definitions';

import { PuzzleRow } from '@app/repository/definition/puzzle-schema.interface';
import { PuzzleRepository } from '@app/repository/puzzle.repository';

@Injectable({
	providedIn: 'root',
})
export class PuzzleCacheUseCase {
	private readonly puzzles = inject(PuzzleRepository);

	async save(puzzles: readonly ApiPuzzle[]): Promise<void> {
		if (0 === puzzles.length) {
			return;
		}

		const now = new Date();

		await this.puzzles
			.runInTransaction(['puzzle'], 'readwrite', async (transaction) => {
				const store = transaction.objectStore('puzzle');

				await Promise.all(
					puzzles.map(async (puzzle) => {
						const stored = await store.get(puzzle.lichessId);

						if (stored?.uuid !== puzzle.uuid) {
							await store.put(this.toRow(puzzle, stored, now));
						}
					}),
				);
			})
			.catch(() => undefined);
	}

	private toRow(puzzle: ApiPuzzle, stored: PuzzleRow | undefined, now: Date): PuzzleRow {
		return {
			uuid: puzzle.uuid,
			lichessId: puzzle.lichessId,
			fen: puzzle.fen,
			moves: puzzle.moves,
			rating: puzzle.rating,
			themes: puzzle.themes,
			createdAt: stored?.createdAt ?? now,
			updatedAt: now,
			syncedAt: now,
		};
	}
}
