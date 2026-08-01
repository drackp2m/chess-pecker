import { Puzzle } from '../../puzzle/puzzle.entity';

export interface CalibrationRoundPuzzles {
	/** Los que repartió la ronda, intentados o no: uno si es sondeo, diez si es afinado. */
	total: number;
	attempted: number;
	/** Sólo los que quedan por intentar, en el orden en que se repartieron. */
	puzzles: Puzzle[];
}
