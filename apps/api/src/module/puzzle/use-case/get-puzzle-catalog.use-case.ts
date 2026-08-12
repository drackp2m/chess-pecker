import { Injectable } from '@nestjs/common';

import { PuzzleCatalogPage } from '../definition/puzzle-catalog-page.interface';
import { GetPuzzleCatalogRequestDto } from '../dto/request/get-puzzle-catalog-request.dto';
import { PuzzleRepository } from '../puzzle.repository';

@Injectable()
export class GetPuzzleCatalogUseCase {
	private static readonly defaultLimit = 500;

	constructor(private readonly puzzleRepository: PuzzleRepository) {}

	async execute(request: GetPuzzleCatalogRequestDto): Promise<PuzzleCatalogPage> {
		const limit = request.limit ?? GetPuzzleCatalogUseCase.defaultLimit;
		const total = await this.puzzleRepository.countAll();
		const items = await this.puzzleRepository.getManyAfterLichessId(limit, request.after);
		const last = items[items.length - 1];

		return {
			items,
			nextCursor: items.length < limit || undefined === last ? null : last.lichessId,
			total,
		};
	}
}
