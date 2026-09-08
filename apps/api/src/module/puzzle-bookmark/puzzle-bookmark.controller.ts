import {
	deletePuzzleBookmarkRequestSchema,
	upsertPuzzleBookmarkRequestSchema,
} from '@chesspecker/api-definitions';
import type {
	DeletePuzzleBookmarkRequestParsed,
	PuzzleBookmarkHistoryEntry,
	PuzzleBookmark as PuzzleBookmarkResponse,
	UpsertPuzzleBookmarkRequestParsed,
} from '@chesspecker/api-definitions';
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Inject,
	Param,
	Put,
	Query,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { User } from '../user/user.entity';

import { DeletePuzzleBookmarkUseCase } from './use-case/delete-puzzle-bookmark.use-case';
import { ListPuzzleBookmarkHistoryUseCase } from './use-case/list-puzzle-bookmark-history.use-case';
import { ListPuzzleBookmarksUseCase } from './use-case/list-puzzle-bookmarks.use-case';
import { UpsertPuzzleBookmarkUseCase } from './use-case/upsert-puzzle-bookmark.use-case';

@Controller('puzzle-bookmark')
export class PuzzleBookmarkController {
	constructor(
		@Inject(ListPuzzleBookmarksUseCase)
		private readonly listPuzzleBookmarksUseCase: ListPuzzleBookmarksUseCase,
		@Inject(UpsertPuzzleBookmarkUseCase)
		private readonly upsertPuzzleBookmarkUseCase: UpsertPuzzleBookmarkUseCase,
		@Inject(ListPuzzleBookmarkHistoryUseCase)
		private readonly listPuzzleBookmarkHistoryUseCase: ListPuzzleBookmarkHistoryUseCase,
		@Inject(DeletePuzzleBookmarkUseCase)
		private readonly deletePuzzleBookmarkUseCase: DeletePuzzleBookmarkUseCase,
	) {}

	@Get()
	async getAll(@CurrentUser() user: User): Promise<PuzzleBookmarkResponse[]> {
		return this.listPuzzleBookmarksUseCase.execute(user);
	}

	@Get('history')
	async getHistory(@CurrentUser() user: User): Promise<PuzzleBookmarkHistoryEntry[]> {
		return this.listPuzzleBookmarkHistoryUseCase.execute(user);
	}

	@Put(':lichessId')
	async upsert(
		@CurrentUser() user: User,
		@Param('lichessId') lichessId: string,
		@Body({ schema: upsertPuzzleBookmarkRequestSchema })
		upsertRequest: UpsertPuzzleBookmarkRequestParsed,
	): Promise<PuzzleBookmarkResponse> {
		return this.upsertPuzzleBookmarkUseCase.execute(user, lichessId, upsertRequest);
	}

	@Delete(':lichessId')
	@HttpCode(HttpStatus.NO_CONTENT)
	async delete(
		@CurrentUser() user: User,
		@Param('lichessId') lichessId: string,
		@Query({ schema: deletePuzzleBookmarkRequestSchema }) query: DeletePuzzleBookmarkRequestParsed,
	): Promise<void> {
		return this.deletePuzzleBookmarkUseCase.execute(user, lichessId, query);
	}
}
