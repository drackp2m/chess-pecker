import { Puzzle } from '../puzzle.entity';

export interface PuzzleCatalogPage {
	items: Puzzle[];
	nextCursor: string | null;
	total: number;
}
