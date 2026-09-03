import { z } from 'zod';

/**
 * An exercise as the API serves it, which is not the shape the board reads: it keys by
 * Lichess id and the API by `uuid`, so both travel together. `PuzzleMapper` converts.
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

const importPuzzleItemSchema = z.object({
	lichessId: z.string().min(1),
	fen: z.string().min(1),
	moves: z.array(z.string()).min(1),
	rating: z.number().int().min(0),
	themes: z.array(z.string()),
});

export const importPuzzleRequestSchema = z.object({
	puzzles: z.array(importPuzzleItemSchema).min(1).max(5000),
});

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

export const searchPuzzleRequestSchema = z.object({
	ratingMin: z.coerce.number().int().min(0).optional(),
	ratingMax: z.coerce.number().int().min(0).optional(),
	themes: z
		.union([z.array(z.string()), z.string().transform((value) => value.split(','))])
		.optional(),
	limit: z.coerce.number().int().min(1).max(500).optional(),
	offset: z.coerce.number().int().min(0).optional(),
});

export interface GetPuzzleCatalogRequest {
	after?: string;
	limit?: number;
}

export const getPuzzleCatalogRequestSchema = z.object({
	after: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(500).optional(),
});

export interface PuzzleCatalogPage {
	readonly items: readonly ApiPuzzle[];
	readonly nextCursor: string | null;
	readonly total: number;
}
