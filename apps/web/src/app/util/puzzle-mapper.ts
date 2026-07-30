import { Puzzle } from '@app/definition/puzzle.type';
import { ApiPuzzle } from '@app/definition/training.interface';

const RATING_BUCKET_SIZE = 100;

export abstract class PuzzleMapper {
	static toPuzzle(puzzle: ApiPuzzle): Puzzle {
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
