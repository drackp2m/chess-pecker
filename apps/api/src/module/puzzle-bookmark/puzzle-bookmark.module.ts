import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { PuzzleModule } from '../puzzle/puzzle.module';

import { PuzzleBookmarkHistory } from './puzzle-bookmark-history.entity';
import { PuzzleBookmarkController } from './puzzle-bookmark.controller';
import { PuzzleBookmark } from './puzzle-bookmark.entity';
import { DeletePuzzleBookmarkUseCase } from './use-case/delete-puzzle-bookmark.use-case';
import { ListPuzzleBookmarkHistoryUseCase } from './use-case/list-puzzle-bookmark-history.use-case';
import { ListPuzzleBookmarksUseCase } from './use-case/list-puzzle-bookmarks.use-case';
import { UpsertPuzzleBookmarkUseCase } from './use-case/upsert-puzzle-bookmark.use-case';

@Module({
	imports: [MikroOrmModule.forFeature([PuzzleBookmark, PuzzleBookmarkHistory]), PuzzleModule],
	providers: [
		ListPuzzleBookmarksUseCase,
		ListPuzzleBookmarkHistoryUseCase,
		UpsertPuzzleBookmarkUseCase,
		DeletePuzzleBookmarkUseCase,
	],
	exports: [MikroOrmModule],
	controllers: [PuzzleBookmarkController],
})
export class PuzzleBookmarkModule {}
