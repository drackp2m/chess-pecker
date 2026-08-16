import type { ApiPuzzle } from '@chesspecker/api-definitions';

import { Puzzle } from '@app/definition/puzzle.type';
import { PuzzleRow } from '@app/repository/definition/puzzle-schema.interface';

const RATING_BUCKET_SIZE = 100;

export abstract class PuzzleMapper {
	static toRow(puzzle: ApiPuzzle): PuzzleRow {
		const now = new Date();

		return {
			uuid: puzzle.uuid,
			lichessId: puzzle.lichessId,
			fen: puzzle.fen,
			moves: puzzle.moves,
			rating: puzzle.rating,
			themes: puzzle.themes,
			createdAt: now,
			updatedAt: now,
			syncedAt: now,
		};
	}

	static toKey(puzzle: PuzzleRow): string {
		return puzzle.uuid ?? puzzle.lichessId;
	}

	static toPuzzle(puzzle: Omit<ApiPuzzle, 'uuid'>): Puzzle {
		const bucket = Math.floor(puzzle.rating / RATING_BUCKET_SIZE) * RATING_BUCKET_SIZE;

		return {
			id: puzzle.lichessId,
			fen: puzzle.fen,
			moves: puzzle.moves,
			rating: puzzle.rating,
			themes: puzzle.themes,
			selectedFor: `${bucket.toString()}-${(bucket + RATING_BUCKET_SIZE - 1).toString()}`,
		};
	}
}
