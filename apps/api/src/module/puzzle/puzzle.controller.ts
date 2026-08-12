import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { ProtectTo } from '../auth/decorator/protect-to.decorator';
import { UserRole } from '../user/definition/user-role.enum';

import { PuzzleCatalogPage } from './definition/puzzle-catalog-page.interface';
import { GetPuzzleCatalogRequestDto } from './dto/request/get-puzzle-catalog-request.dto';
import { ImportPuzzleRequestDto } from './dto/request/import-puzzle-request.dto';
import { SearchPuzzleRequestDto } from './dto/request/search-puzzle-request.dto';
import { Puzzle } from './puzzle.entity';
import { GetPuzzleCatalogUseCase } from './use-case/get-puzzle-catalog.use-case';
import { GetPuzzleUseCase } from './use-case/get-puzzle.use-case';
import { ImportPuzzlesUseCase } from './use-case/import-puzzles.use-case';
import { SearchPuzzlesUseCase } from './use-case/search-puzzles.use-case';

@Controller('puzzle')
export class PuzzleController {
	constructor(
		private readonly searchPuzzlesUseCase: SearchPuzzlesUseCase,
		private readonly getPuzzleCatalogUseCase: GetPuzzleCatalogUseCase,
		private readonly getPuzzleUseCase: GetPuzzleUseCase,
		private readonly importPuzzlesUseCase: ImportPuzzlesUseCase,
	) {}

	@Get()
	async search(@Query() search: SearchPuzzleRequestDto): Promise<Puzzle[]> {
		return this.searchPuzzlesUseCase.execute(search);
	}

	@Get('catalog')
	async getCatalog(@Query() query: GetPuzzleCatalogRequestDto): Promise<PuzzleCatalogPage> {
		return this.getPuzzleCatalogUseCase.execute(query);
	}

	@Get(':lichessId')
	async getOne(@Param('lichessId') lichessId: string): Promise<Puzzle> {
		return this.getPuzzleUseCase.execute(lichessId);
	}

	@Post('import')
	@ProtectTo(UserRole.Admin)
	async import(@Body() importRequest: ImportPuzzleRequestDto): Promise<{ imported: number }> {
		return this.importPuzzlesUseCase.execute(importRequest);
	}
}
