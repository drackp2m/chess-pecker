import { PuzzleDifficulty } from '@app/definition/puzzle.type';

const MEDIUM_THRESHOLD = 25;
const HARD_THRESHOLD = 75;
const BAND_SIZE = 100;

/** Reads the last two digits of the rating as a 0-99 difficulty band. */
export function puzzleDifficulty(rating: number): PuzzleDifficulty {
	const band = ((rating % BAND_SIZE) + BAND_SIZE) % BAND_SIZE;

	if (band < MEDIUM_THRESHOLD) {
		return 'easy';
	}

	return band < HARD_THRESHOLD ? 'medium' : 'hard';
}
