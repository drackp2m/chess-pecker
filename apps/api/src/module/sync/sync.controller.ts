import type { PushTrainingResult, SyncSummary } from '@chesspecker/api-definitions';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { GetOwnedTrainingUseCase } from '../training/use-case/get-owned-training.use-case';
import { User } from '../user/user.entity';

import { SyncTrainingTree } from './definition/sync-training-tree.interface';
import { GetTrainingTreeRequestDto } from './dto/request/get-training-tree-request.dto';
import { PushTrainingRequestDto } from './dto/request/push-training-request.dto';
import { GetSyncSummaryUseCase } from './use-case/get-sync-summary.use-case';
import { GetTrainingTreeUseCase } from './use-case/get-training-tree.use-case';
import { PushTrainingTreeUseCase } from './use-case/push-training-tree.use-case';

/**
 * The replica's store. No training happens here: it keeps what the device already decided,
 * which is where the domain lives.
 */
@Controller('sync')
export class SyncController {
	constructor(
		private readonly getSyncSummaryUseCase: GetSyncSummaryUseCase,
		private readonly getOwnedTrainingUseCase: GetOwnedTrainingUseCase,
		private readonly getTrainingTreeUseCase: GetTrainingTreeUseCase,
		private readonly pushTrainingTreeUseCase: PushTrainingTreeUseCase,
	) {}

	/** What is here: per table, how far the server clock reaches and how many rows there are. */
	@Get()
	async getSummary(@CurrentUser() user: User): Promise<SyncSummary> {
		return this.getSyncSummaryUseCase.execute(user);
	}

	@Get('training/:uuid')
	async getTrainingTree(
		@CurrentUser() user: User,
		@Param('uuid') uuid: string,
		@Query() query: GetTrainingTreeRequestDto,
	): Promise<SyncTrainingTree> {
		const training = await this.getOwnedTrainingUseCase.execute(user, uuid);

		return this.getTrainingTreeUseCase.execute(training, query.since);
	}

	@Post('training')
	async pushTraining(
		@CurrentUser() user: User,
		@Body() pushRequest: PushTrainingRequestDto,
	): Promise<PushTrainingResult> {
		return this.pushTrainingTreeUseCase.execute(user, pushRequest);
	}
}
