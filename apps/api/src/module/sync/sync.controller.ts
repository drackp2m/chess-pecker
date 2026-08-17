import type { PushTrainingResult, SyncSummary } from '@chesspecker/api-definitions';
import { Body, Controller, Get, Post } from '@nestjs/common';

import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { User } from '../user/user.entity';

import { PushTrainingRequestDto } from './dto/request/push-training-request.dto';
import { GetSyncSummaryUseCase } from './use-case/get-sync-summary.use-case';
import { PushTrainingTreeUseCase } from './use-case/push-training-tree.use-case';

/**
 * El almacén de la réplica. Aquí no se entrena: se guarda lo que el dispositivo ya decidió,
 * que es donde vive el dominio desde que la aplicación es local-first.
 */
@Controller('sync')
export class SyncController {
	constructor(
		private readonly getSyncSummaryUseCase: GetSyncSummaryUseCase,
		private readonly pushTrainingTreeUseCase: PushTrainingTreeUseCase,
	) {}

	/** Qué hay aquí: por tabla, hasta dónde llega el reloj de servidor y cuántas filas hay. */
	@Get()
	async getSummary(@CurrentUser() user: User): Promise<SyncSummary> {
		return this.getSyncSummaryUseCase.execute(user);
	}

	@Post('training')
	async pushTraining(
		@CurrentUser() user: User,
		@Body() pushRequest: PushTrainingRequestDto,
	): Promise<PushTrainingResult> {
		return this.pushTrainingTreeUseCase.execute(user, pushRequest);
	}
}
