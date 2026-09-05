import type { ImportPuzzleRequest } from '@chesspecker/api-definitions';
import { Inject, Injectable } from '@nestjs/common';

import { Puzzle } from '../puzzle.entity';
import { PuzzleRepository } from '../puzzle.repository';

@Injectable()
export class ImportPuzzlesUseCase {
	constructor(
		@Inject(PuzzleRepository)
		private readonly puzzleRepository: PuzzleRepository,
	) {}

	async execute(importRequest: ImportPuzzleRequest): Promise<{ imported: number }> {
		const puzzles = importRequest.puzzles.map((puzzle) => new Puzzle(puzzle));

		const upserted = await this.puzzleRepository.upsertManyByLichessId(puzzles);

		return { imported: upserted.length };
	}
}
