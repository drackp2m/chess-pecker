import { Inject, Injectable } from '@nestjs/common';

import { Puzzle } from '../puzzle.entity';
import { PuzzleRepository } from '../puzzle.repository';

@Injectable()
export class GetPuzzleUseCase {
	constructor(
		@Inject(PuzzleRepository)
		private readonly puzzleRepository: PuzzleRepository,
	) {}

	async execute(lichessId: string): Promise<Puzzle> {
		return this.puzzleRepository.getOne({ lichessId });
	}
}
