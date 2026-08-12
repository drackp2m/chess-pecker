import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';

import { Puzzle } from '../puzzle.entity';
import { PuzzleRepository } from '../puzzle.repository';

import { GetPuzzleCatalogUseCase } from './get-puzzle-catalog.use-case';

describe('GetPuzzleCatalogUseCase', () => {
	let useCase: GetPuzzleCatalogUseCase;

	const puzzleRepository = mock<PuzzleRepository>();

	const puzzles = (...lichessIds: string[]): Puzzle[] =>
		lichessIds.map((lichessId) => new Puzzle({ lichessId }));

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				GetPuzzleCatalogUseCase,
				{ provide: PuzzleRepository, useValue: puzzleRepository },
			],
		}).compile();

		useCase = await module.resolve(GetPuzzleCatalogUseCase);
	});

	it('should be defined', () => {
		expect(useCase).toBeDefined();
	});

	describe('execute', () => {
		it('anchor the next page to the last exercise served', async () => {
			puzzleRepository.countAll.mockResolvedValueOnce(9);
			puzzleRepository.getManyAfterLichessId.mockResolvedValueOnce(puzzles('aaa', 'bbb', 'ccc'));

			const page = await useCase.execute({ limit: 3 });

			expect(page.nextCursor).toBe('ccc');
			expect(page.total).toBe(9);
			expect(puzzleRepository.getManyAfterLichessId).toHaveBeenCalledWith(3, undefined);
		});

		it('close the sweep when the page comes back short', async () => {
			puzzleRepository.countAll.mockResolvedValueOnce(5);
			puzzleRepository.getManyAfterLichessId.mockResolvedValueOnce(puzzles('ddd', 'eee'));

			const page = await useCase.execute({ after: 'ccc', limit: 3 });

			expect(page.nextCursor).toBeNull();
			expect(puzzleRepository.getManyAfterLichessId).toHaveBeenCalledWith(3, 'ccc');
		});

		it('close the sweep when there is nothing left after the cursor', async () => {
			puzzleRepository.countAll.mockResolvedValueOnce(5);
			puzzleRepository.getManyAfterLichessId.mockResolvedValueOnce([]);

			const page = await useCase.execute({ after: 'eee' });

			expect(page.items).toEqual([]);
			expect(page.nextCursor).toBeNull();
			expect(puzzleRepository.getManyAfterLichessId).toHaveBeenCalledWith(500, 'eee');
		});
	});
});
