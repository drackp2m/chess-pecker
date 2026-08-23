import { Puzzle } from '../../puzzle/puzzle.entity';

export interface CalibrationRoundPuzzles {
	/** What the round dealt out, attempted or not: one for a scan, ten for a refine. */
	total: number;
	attempted: number;
	/** Only those left to attempt, in the order they were dealt. */
	puzzles: Puzzle[];
}
