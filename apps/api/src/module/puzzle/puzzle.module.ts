import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { PuzzleController } from './puzzle.controller';
import { Puzzle } from './puzzle.entity';
import { GetPuzzleCatalogUseCase } from './use-case/get-puzzle-catalog.use-case';
import { GetPuzzleUseCase } from './use-case/get-puzzle.use-case';
import { ImportPuzzlesUseCase } from './use-case/import-puzzles.use-case';
import { SearchPuzzlesUseCase } from './use-case/search-puzzles.use-case';

@Module({
	imports: [MikroOrmModule.forFeature([Puzzle])],
	providers: [
		SearchPuzzlesUseCase,
		GetPuzzleCatalogUseCase,
		GetPuzzleUseCase,
		ImportPuzzlesUseCase,
	],
	exports: [MikroOrmModule],
	controllers: [PuzzleController],
})
export class PuzzleModule {}
