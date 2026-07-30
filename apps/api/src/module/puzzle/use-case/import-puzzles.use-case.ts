import { Injectable } from '@nestjs/common';

import { ImportPuzzleRequestDto } from '../dto/request/import-puzzle-request.dto';
import { Puzzle } from '../puzzle.entity';
import { PuzzleRepository } from '../puzzle.repository';

@Injectable()
export class ImportPuzzlesUseCase {
	constructor(private readonly puzzleRepository: PuzzleRepository) {}

	async execute(importRequest: ImportPuzzleRequestDto): Promise<{ imported: number }> {
		const puzzles = importRequest.puzzles.map((puzzle) => new Puzzle(puzzle));

		const upserted = await this.puzzleRepository.upsertManyByLichessId(puzzles);

		return { imported: upserted.length };
	}
}
