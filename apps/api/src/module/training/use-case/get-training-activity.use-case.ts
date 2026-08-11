import { Injectable } from '@nestjs/common';

import { GenerateNowDateUseCase } from '../../../shared/use-case/generate-now-date.use-case';
import { User } from '../../user/user.entity';
import { TrainingActivity } from '../definition/training-activity.interface';
import { TrainingPolicy } from '../definition/training-policy';
import { GetTrainingActivityRequestDto } from '../dto/request/get-training-activity-request.dto';
import { PuzzleAttemptRepository } from '../puzzle-attempt.repository';

@Injectable()
export class GetTrainingActivityUseCase {
	constructor(private readonly puzzleAttemptRepository: PuzzleAttemptRepository) {}

	/**
	 * El cursor se lee antes que los días a propósito: lo que entre entre las dos consultas
	 * viaja ya en esta respuesta y volverá a viajar en la siguiente. Repetir un día es
	 * gratis; perdérselo dejaría un día mal guardado para siempre.
	 */
	async execute(user: User, request: GetTrainingActivityRequestDto): Promise<TrainingActivity> {
		const cursor =
			(await this.puzzleAttemptRepository.lastReceivedAt(user.uuid)) ??
			new GenerateNowDateUseCase().execute();

		const days = await this.puzzleAttemptRepository.countByDaySince(
			user.uuid,
			windowStart(request.days),
			request.since,
		);

		return { days, cursor: cursor.toISOString() };
	}
}

function windowStart(days: number | undefined): Date {
	const window = Math.min(days ?? TrainingPolicy.activityMaxDays, TrainingPolicy.activityMaxDays);
	const since = new Date();

	since.setUTCDate(since.getUTCDate() - (window - 1));
	since.setUTCHours(0, 0, 0, 0);

	return since;
}
