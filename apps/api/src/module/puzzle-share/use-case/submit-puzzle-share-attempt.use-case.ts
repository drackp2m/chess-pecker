import type { PuzzleShare as PuzzleShareResponse } from '@chesspecker/api-definitions';
import { Injectable } from '@nestjs/common';

import { PreconditionFailedException } from '../../../shared/exception/precondition-failed.exception';
import { UserNotificationType } from '../../notification/definition/user-notification-type.enum';
import { CreateNotificationsUseCase } from '../../notification/use-case/create-notifications.use-case';
import { User } from '../../user/user.entity';
import { PuzzleShareResultRequestDto } from '../dto/request/puzzle-share-result-request.dto';
import { PuzzleShareAttemptRepository } from '../puzzle-share-attempt.repository';
import { PuzzleShareRecipientRepository } from '../puzzle-share-recipient.repository';
import { PuzzleShare } from '../puzzle-share.entity';
import { buildAttempt } from '../util/puzzle-share.util';

import { GetPuzzleShareUseCase } from './get-puzzle-share.use-case';
import { PresentPuzzleSharesUseCase } from './present-puzzle-shares.use-case';

@Injectable()
export class SubmitPuzzleShareAttemptUseCase {
	constructor(
		private readonly puzzleShareAttemptRepository: PuzzleShareAttemptRepository,
		private readonly puzzleShareRecipientRepository: PuzzleShareRecipientRepository,
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
		request: PuzzleShareResultRequestDto,
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
