import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Query,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { User } from '../user/user.entity';

import { TrainingActivity } from './definition/training-activity.interface';
import { TrainingAttemptHistory } from './definition/training-attempt-history.interface';
import { TrainingProgress } from './definition/training-progress.interface';
import { GetTrainingActivityRequestDto } from './dto/request/get-training-activity-request.dto';
import { GetTrainingAttemptsRequestDto } from './dto/request/get-training-attempts-request.dto';
import { SelectTrainingSetRequestDto } from './dto/request/select-training-set-request.dto';
import { SetTrainingGoalRequestDto } from './dto/request/set-training-goal-request.dto';
import { TrainingGoal } from './training-goal.entity';
import { Training } from './training.entity';
import { FinishTrainingUseCase } from './use-case/finish-training.use-case';
import { GetOwnedTrainingUseCase } from './use-case/get-owned-training.use-case';
import { GetTrainingActivityUseCase } from './use-case/get-training-activity.use-case';
import { GetTrainingProgressUseCase } from './use-case/get-training-progress.use-case';
import { ListTrainingAttemptsUseCase } from './use-case/list-training-attempts.use-case';
import { ListTrainingsUseCase } from './use-case/list-trainings.use-case';
import { SelectTrainingSetUseCase } from './use-case/select-training-set.use-case';
import { SetTrainingGoalUseCase } from './use-case/set-training-goal.use-case';
import { StartTrainingUseCase } from './use-case/start-training.use-case';

@Controller('training')
export class TrainingController {
	constructor(
		private readonly startTrainingUseCase: StartTrainingUseCase,
		private readonly listTrainingsUseCase: ListTrainingsUseCase,
		private readonly getOwnedTrainingUseCase: GetOwnedTrainingUseCase,
		private readonly selectTrainingSetUseCase: SelectTrainingSetUseCase,
		private readonly setTrainingGoalUseCase: SetTrainingGoalUseCase,
		private readonly getTrainingProgressUseCase: GetTrainingProgressUseCase,
		private readonly getTrainingActivityUseCase: GetTrainingActivityUseCase,
		private readonly listTrainingAttemptsUseCase: ListTrainingAttemptsUseCase,
		private readonly finishTrainingUseCase: FinishTrainingUseCase,
	) {}

	@Get()
	async list(@CurrentUser() user: User): Promise<Training[]> {
		return this.listTrainingsUseCase.execute(user);
	}

	/** Agregado sobre todos los entrenamientos del usuario, no de uno solo: va antes de `:uuid`. */
	@Get('activity')
	async getActivity(
		@CurrentUser() user: User,
		@Query() query: GetTrainingActivityRequestDto,
	): Promise<TrainingActivity> {
		return this.getTrainingActivityUseCase.execute(user, query);
	}

	@Post()
	async start(@CurrentUser() user: User): Promise<Training> {
		return this.startTrainingUseCase.execute(user);
	}

	@Get(':uuid')
	async getOne(@CurrentUser() user: User, @Param('uuid') uuid: string): Promise<Training> {
		return this.getOwnedTrainingUseCase.execute(user, uuid);
	}

	@Get(':uuid/progress')
	async getProgress(
		@CurrentUser() user: User,
		@Param('uuid') uuid: string,
	): Promise<TrainingProgress> {
		const training = await this.getOwnedTrainingUseCase.execute(user, uuid);

		return this.getTrainingProgressUseCase.execute(training);
	}

	/**
	 * El histórico de ejercicios cerrados. Es de donde un dispositivo sin nada vuelve a
	 * levantar lo ya resuelto, así que el ejercicio viaja dentro de cada intento: quien
	 * pregunta puede no tenerlo en su catálogo.
	 */
	@Get(':uuid/attempt')
	async listAttempts(
		@CurrentUser() user: User,
		@Param('uuid') uuid: string,
		@Query() query: GetTrainingAttemptsRequestDto,
	): Promise<TrainingAttemptHistory> {
		const training = await this.getOwnedTrainingUseCase.execute(user, uuid);

		return this.listTrainingAttemptsUseCase.execute(training, query);
	}

	/** Fase 2: fijar los X ejercicios sobre los que van a correr todos los ciclos. */
	@Post(':uuid/set')
	async selectSet(
		@CurrentUser() user: User,
		@Param('uuid') uuid: string,
		@Body() selectRequest: SelectTrainingSetRequestDto,
	): Promise<{ size: number }> {
		const training = await this.getOwnedTrainingUseCase.execute(user, uuid);

		return { size: await this.selectTrainingSetUseCase.execute(training, selectRequest) };
	}

	/** Cada llamada añade un objetivo nuevo; el vigente es el último. */
	@Post(':uuid/goal')
	async setGoal(
		@CurrentUser() user: User,
		@Param('uuid') uuid: string,
		@Body() goalRequest: SetTrainingGoalRequestDto,
	): Promise<TrainingGoal> {
		const training = await this.getOwnedTrainingUseCase.execute(user, uuid);

		return this.setTrainingGoalUseCase.execute(training, goalRequest);
	}

	/** Darlo por completado: exige haber cerrado el mínimo de ciclos. */
	@Post(':uuid/finish')
	@HttpCode(HttpStatus.NO_CONTENT)
	async finish(@CurrentUser() user: User, @Param('uuid') uuid: string): Promise<void> {
		const training = await this.getOwnedTrainingUseCase.execute(user, uuid);

		return this.finishTrainingUseCase.execute(training, false);
	}

	/** Cancelarlo, que se puede en cualquier momento. No borra nada: el histórico sirve igual. */
	@Delete(':uuid')
	@HttpCode(HttpStatus.NO_CONTENT)
	async cancel(@CurrentUser() user: User, @Param('uuid') uuid: string): Promise<void> {
		const training = await this.getOwnedTrainingUseCase.execute(user, uuid);

		return this.finishTrainingUseCase.execute(training, true);
	}
}
