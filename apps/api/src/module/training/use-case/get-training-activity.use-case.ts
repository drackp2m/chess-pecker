import { Injectable } from '@nestjs/common';

import { User } from '../../user/user.entity';
import { TrainingActivityDay } from '../definition/training-activity.interface';
import { PuzzleAttemptRepository } from '../puzzle-attempt.repository';

const ACTIVITY_WEEKS = 53;
const ACTIVITY_WINDOW_DAYS = ACTIVITY_WEEKS * 7;

@Injectable()
export class GetTrainingActivityUseCase {
	constructor(private readonly puzzleAttemptRepository: PuzzleAttemptRepository) {}

	async execute(user: User): Promise<TrainingActivityDay[]> {
		const since = new Date();
		since.setUTCDate(since.getUTCDate() - ACTIVITY_WINDOW_DAYS);
		since.setUTCHours(0, 0, 0, 0);

		return this.puzzleAttemptRepository.countByDaySince(user.uuid, since);
	}
}
