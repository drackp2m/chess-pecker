import type { PuzzleBookmark as PuzzleBookmarkResponse } from '@chesspecker/api-definitions';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';

import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { User } from '../user/user.entity';

import { UpsertPuzzleBookmarkRequestDto } from './dto/request/upsert-puzzle-bookmark-request.dto';
import { DeletePuzzleBookmarkUseCase } from './use-case/delete-puzzle-bookmark.use-case';
import { ListPuzzleBookmarksUseCase } from './use-case/list-puzzle-bookmarks.use-case';
import { UpsertPuzzleBookmarkUseCase } from './use-case/upsert-puzzle-bookmark.use-case';

@Controller('puzzle-bookmark')
export class PuzzleBookmarkController {
	constructor(
		private readonly listPuzzleBookmarksUseCase: ListPuzzleBookmarksUseCase,
		private readonly upsertPuzzleBookmarkUseCase: UpsertPuzzleBookmarkUseCase,
		private readonly deletePuzzleBookmarkUseCase: DeletePuzzleBookmarkUseCase,
	) {}

	@Get()
	async getAll(@CurrentUser() user: User): Promise<PuzzleBookmarkResponse[]> {
		return this.listPuzzleBookmarksUseCase.execute(user);
	}

	@Put(':lichessId')
	async upsert(
		@CurrentUser() user: User,
		@Param('lichessId') lichessId: string,
		@Body() upsertRequest: UpsertPuzzleBookmarkRequestDto,
	): Promise<PuzzleBookmarkResponse> {
		return this.upsertPuzzleBookmarkUseCase.execute(user, lichessId, upsertRequest);
	}

	@Delete(':lichessId')
	@HttpCode(HttpStatus.NO_CONTENT)
	async delete(@CurrentUser() user: User, @Param('lichessId') lichessId: string): Promise<void> {
		return this.deletePuzzleBookmarkUseCase.execute(user, lichessId);
	}
}
