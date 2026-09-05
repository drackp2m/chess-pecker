import type { GetTrainingActivityRequest } from '@chesspecker/api-definitions';
import { Inject, Injectable } from '@nestjs/common';

import { GenerateNowDateUseCase } from '../../../shared/use-case/generate-now-date.use-case';
import { User } from '../../user/user.entity';
import { TrainingActivity } from '../definition/training-activity.interface';
import { TrainingPolicy } from '../definition/training-policy';
import { PuzzleAttemptRepository } from '../puzzle-attempt.repository';

@Injectable()
export class GetTrainingActivityUseCase {
	constructor(
		@Inject(PuzzleAttemptRepository)
		private readonly puzzleAttemptRepository: PuzzleAttemptRepository,
	) {}

	/**
	 * The cursor is read before the days on purpose: repeating a day is free, missing one
	 * would leave it wrong forever.
	 */
	async execute(user: User, request: GetTrainingActivityRequest<Date>): Promise<TrainingActivity> {
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
