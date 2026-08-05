import { Injectable, inject } from '@angular/core';

import { Puzzle } from '@app/definition/puzzle.type';
import { PuzzleRow } from '@app/repository/definition/puzzle-schema.interface';
import { PuzzleSetRow } from '@app/repository/definition/puzzle-set-schema.interface';
import { PuzzleSetRepository } from '@app/repository/puzzle-set.repository';
import { PuzzleRepository } from '@app/repository/puzzle.repository';
import { PuzzleMapper } from '@app/util/puzzle-mapper';

/** A set as the library reads it back: what it is called, and the rows behind its ids. */
export interface StoredPuzzleSet {
	readonly uuid: string;
	readonly name: string;
	readonly puzzles: readonly Puzzle[];
}

@Injectable({
	providedIn: 'root',
})
export class PuzzleImportUseCase {
	private readonly puzzles = inject(PuzzleRepository);
	private readonly sets = inject(PuzzleSetRepository);

	async import(name: string, puzzles: readonly Puzzle[]): Promise<StoredPuzzleSet> {
		const now = new Date();

		await this.writePuzzles(puzzles, now);

		const set: PuzzleSetRow = {
			uuid: crypto.randomUUID(),
			name,
			lichessIds: puzzles.map((puzzle) => puzzle.id),
			createdAt: now,
			updatedAt: now,
		};

		await this.sets.insert('puzzleSet', set);

		return { uuid: set.uuid, name: set.name, puzzles };
	}

	/** The set a reload reopens with: the last one imported. */
	async findLast(): Promise<StoredPuzzleSet | undefined> {
		const sets = await this.sets.findAll('puzzleSet');
		const last = sets.reduce<PuzzleSetRow | undefined>(
			(latest, set) =>
				undefined === latest || latest.createdAt.getTime() < set.createdAt.getTime() ? set : latest,
			undefined,
		);

		if (undefined === last) {
			return undefined;
		}

		return { uuid: last.uuid, name: last.name, puzzles: await this.readPuzzles(last.lichessIds) };
	}

	/**
	 * Reads the rows by id rather than the whole store: the same table holds the
	 * catalogue replica, which is tens of thousands of exercises.
	 */
	private async readPuzzles(lichessIds: readonly string[]): Promise<readonly Puzzle[]> {
		const rows = await this.puzzles.runInTransaction(['puzzle'], 'readonly', (transaction) => {
			const store = transaction.objectStore('puzzle');

			return Promise.all(lichessIds.map((lichessId) => store.get(lichessId)));
		});

		return rows
			.filter((row): row is PuzzleRow => undefined !== row)
			.map((row) => PuzzleMapper.toPuzzle(row));
	}

	/**
	 * One transaction for the batch, reading each row first so re-importing a set does
	 * not drop the server `uuid` an earlier download left on it.
	 */
	private async writePuzzles(puzzles: readonly Puzzle[], now: Date): Promise<void> {
		await this.puzzles.runInTransaction(['puzzle'], 'readwrite', async (transaction) => {
			const store = transaction.objectStore('puzzle');

			await Promise.all(
				puzzles.map(async (puzzle) => {
					const stored = await store.get(puzzle.id);

					await store.put(this.toRow(puzzle, stored, now));
				}),
			);
		});
	}

	private toRow(puzzle: Puzzle, stored: PuzzleRow | undefined, now: Date): PuzzleRow {
		return {
			lichessId: puzzle.id,
			fen: puzzle.fen,
			moves: puzzle.moves,
			rating: puzzle.rating,
			themes: puzzle.themes,
			createdAt: stored?.createdAt ?? now,
			updatedAt: now,
			...(undefined === stored?.uuid ? {} : { uuid: stored.uuid }),
			...(undefined === stored?.syncedAt ? {} : { syncedAt: stored.syncedAt }),
		};
	}
}
