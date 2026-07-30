import { FilterQuery } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';

import { SearchPuzzleRequestDto } from '../dto/request/search-puzzle-request.dto';
import { Puzzle } from '../puzzle.entity';
import { PuzzleRepository } from '../puzzle.repository';

@Injectable()
export class SearchPuzzlesUseCase {
	private static readonly defaultLimit = 50;

	constructor(private readonly puzzleRepository: PuzzleRepository) {}

	async execute(search: SearchPuzzleRequestDto): Promise<Puzzle[]> {
		const query: FilterQuery<Puzzle> = {
			...(search.ratingMin !== undefined || search.ratingMax !== undefined
				? {
						rating: {
							...(search.ratingMin !== undefined ? { $gte: search.ratingMin } : {}),
							...(search.ratingMax !== undefined ? { $lte: search.ratingMax } : {}),
						},
					}
				: {}),
			...(search.themes !== undefined && 0 < search.themes.length
				? { themes: { $contains: search.themes } }
				: {}),
		};

		return this.puzzleRepository.getMany(query, {
			limit: search.limit ?? SearchPuzzlesUseCase.defaultLimit,
			offset: search.offset ?? 0,
			orderBy: { rating: 'asc' },
		});
	}
}
