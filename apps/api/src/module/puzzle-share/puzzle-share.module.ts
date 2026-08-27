import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { FriendshipModule } from '../friendship/friendship.module';
import { NotificationModule } from '../notification/notification.module';
import { PuzzleModule } from '../puzzle/puzzle.module';
import { TrainingModule } from '../training/training.module';
import { UserModule } from '../user/user.module';

import { PuzzleShareAttempt } from './puzzle-share-attempt.entity';
import { PuzzleShareRecipient } from './puzzle-share-recipient.entity';
import { PuzzleShareController } from './puzzle-share.controller';
import { PuzzleShare } from './puzzle-share.entity';
import { CreatePuzzleShareUseCase } from './use-case/create-puzzle-share.use-case';
import { GetPuzzleShareUseCase } from './use-case/get-puzzle-share.use-case';
import { ListPuzzleSharesUseCase } from './use-case/list-puzzle-shares.use-case';
import { PresentPuzzleSharesUseCase } from './use-case/present-puzzle-shares.use-case';
import { SubmitPuzzleShareAttemptUseCase } from './use-case/submit-puzzle-share-attempt.use-case';

/**
 * `TrainingModule` is here for the attempt a challenge points back at, and `FriendshipModule`
 * for the list a recipient has to be on: an exercise only goes to people you already know.
 */
@Module({
	imports: [
		MikroOrmModule.forFeature([PuzzleShare, PuzzleShareRecipient, PuzzleShareAttempt]),
		PuzzleModule,
		UserModule,
		FriendshipModule,
		TrainingModule,
		NotificationModule,
	],
	providers: [
		CreatePuzzleShareUseCase,
		ListPuzzleSharesUseCase,
		GetPuzzleShareUseCase,
		SubmitPuzzleShareAttemptUseCase,
		PresentPuzzleSharesUseCase,
	],
	exports: [MikroOrmModule],
	controllers: [PuzzleShareController],
})
export class PuzzleShareModule {}
