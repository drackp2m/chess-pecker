import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { PuzzleModule } from '../puzzle/puzzle.module';

import { PuzzleBookmarkController } from './puzzle-bookmark.controller';
import { PuzzleBookmark } from './puzzle-bookmark.entity';
import { DeletePuzzleBookmarkUseCase } from './use-case/delete-puzzle-bookmark.use-case';
import { ListPuzzleBookmarksUseCase } from './use-case/list-puzzle-bookmarks.use-case';
import { UpsertPuzzleBookmarkUseCase } from './use-case/upsert-puzzle-bookmark.use-case';

@Module({
	imports: [MikroOrmModule.forFeature([PuzzleBookmark]), PuzzleModule],
	providers: [ListPuzzleBookmarksUseCase, UpsertPuzzleBookmarkUseCase, DeletePuzzleBookmarkUseCase],
	exports: [MikroOrmModule],
	controllers: [PuzzleBookmarkController],
})
export class PuzzleBookmarkModule {}
