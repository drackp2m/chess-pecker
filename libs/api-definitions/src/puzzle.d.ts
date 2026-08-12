/**
 * An exercise as the API serves it. It is not the shape the board reads: there the
 * exercise is keyed by its Lichess id, while every write back to the API goes by
 * `uuid`, so both have to travel together. `PuzzleMapper` does the conversion.
 */
export interface ApiPuzzle {
	readonly uuid: string;
	readonly lichessId: string;
	readonly fen: string;
	readonly moves: readonly string[];
	readonly rating: number;
	readonly themes: readonly string[];
}

export interface ImportPuzzleItem {
	lichessId: string;
	fen: string;
	moves: string[];
	rating: number;
	themes: string[];
}

export interface ImportPuzzleRequest {
	puzzles: ImportPuzzleItem[];
}

export interface ImportPuzzleResult {
	readonly imported: number;
}

export interface SearchPuzzleRequest {
	ratingMin?: number;
	ratingMax?: number;
	themes?: string[];
	limit?: number;
	offset?: number;
}

export interface GetPuzzleCatalogRequest {
	after?: string;
	limit?: number;
}

export interface PuzzleCatalogPage {
	readonly items: readonly ApiPuzzle[];
	readonly nextCursor: string | null;
	readonly total: number;
}
