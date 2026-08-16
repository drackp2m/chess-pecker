import type { PushTrainingResult } from '@chesspecker/api-definitions';
import { Body, Controller, Post } from '@nestjs/common';

import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { User } from '../user/user.entity';

import { PushTrainingRequestDto } from './dto/request/push-training-request.dto';
import { PushTrainingTreeUseCase } from './use-case/push-training-tree.use-case';

/**
 * El almacén de la réplica. Aquí no se entrena: se guarda lo que el dispositivo ya decidió,
 * que es donde vive el dominio desde que la aplicación es local-first.
 */
@Controller('sync')
export class SyncController {
	constructor(private readonly pushTrainingTreeUseCase: PushTrainingTreeUseCase) {}

	@Post('training')
	async pushTraining(
		@CurrentUser() user: User,
		@Body() pushRequest: PushTrainingRequestDto,
	): Promise<PushTrainingResult> {
		return this.pushTrainingTreeUseCase.execute(user, pushRequest);
	}
}
