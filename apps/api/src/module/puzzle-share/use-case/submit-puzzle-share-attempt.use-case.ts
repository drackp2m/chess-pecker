import type {
	PuzzleShare as PuzzleShareResponse,
	PuzzleShareResultRequest,
} from '@chesspecker/api-definitions';
import { Injectable } from '@nestjs/common';

import { PreconditionFailedException } from '../../../shared/exception/precondition-failed.exception';
import { GenerateNowDateUseCase } from '../../../shared/use-case/generate-now-date.use-case';
import { UserNotificationType } from '../../notification/definition/user-notification-type.enum';
import { CreateNotificationsUseCase } from '../../notification/use-case/create-notifications.use-case';
import { User } from '../../user/user.entity';
import { PuzzleShareAttemptRepository } from '../puzzle-share-attempt.repository';
import { PuzzleShareRecipientRepository } from '../puzzle-share-recipient.repository';
import { PuzzleShare } from '../puzzle-share.entity';
import { PuzzleShareRepository } from '../puzzle-share.repository';
import { buildAttempt } from '../util/puzzle-share.util';

import { GetPuzzleShareUseCase } from './get-puzzle-share.use-case';
import { PresentPuzzleSharesUseCase } from './present-puzzle-shares.use-case';

@Injectable()
export class SubmitPuzzleShareAttemptUseCase {
	constructor(
		private readonly puzzleShareAttemptRepository: PuzzleShareAttemptRepository,
		private readonly puzzleShareRecipientRepository: PuzzleShareRecipientRepository,
		private readonly puzzleShareRepository: PuzzleShareRepository,
		private readonly getPuzzleShareUseCase: GetPuzzleShareUseCase,
		private readonly createNotificationsUseCase: CreateNotificationsUseCase,
		private readonly presentPuzzleSharesUseCase: PresentPuzzleSharesUseCase,
	) {}

	/**
	 * The verdict is settled on the first try, here as everywhere else, so answering twice is
	 * refused instead of overwriting what the comparison already showed everybody.
	 */
	async execute(
		user: User,
		uuid: string,
		request: PuzzleShareResultRequest,
	): Promise<PuzzleShareResponse> {
		const share = await this.getPuzzleShareUseCase.execute(user, uuid);
		const answered = await this.puzzleShareAttemptRepository.getMany(
			{ share: share.uuid, user: user.uuid },
			{ limit: 1 },
		);

		if (0 < answered.length) {
			throw new PreconditionFailedException('already answered', 'puzzleShare');
		}

		await this.puzzleShareAttemptRepository.insert(buildAttempt(share, user, request));
		// The answer is a row of its own, so the challenge would look untouched to whoever
		// mirrors it: moving its clock is what carries the verdict to the sender's copy. The
		// loaded entity is moved with it, or the answer would go back out under the old stamp.
		const now = new GenerateNowDateUseCase().execute();

		await this.puzzleShareRepository.touch(share.uuid, now);
		share.updatedAt = now;

		await this.notify(share, user);

		return this.presentPuzzleSharesUseCase.executeOne(share);
	}

	/**
	 * Everybody else in the challenge hears about it, the sender included: what makes it a
	 * challenge is that the rest can see somebody has answered.
	 */
	private async notify(share: PuzzleShare, solver: User): Promise<void> {
		const rows = await this.puzzleShareRecipientRepository.getManyByShares([share.uuid]);
		const audience = [share.sender, ...rows.map((row) => row.recipient)].filter(
			(participant) => participant.uuid !== solver.uuid,
		);

		await this.createNotificationsUseCase.execute(
			audience.map((participant) => ({
				user: participant,
				type: UserNotificationType.PuzzleShareSolved,
				actor: solver,
				share,
			})),
		);
	}
}
