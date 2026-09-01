import type { PuzzleShare as PuzzleShareResponse } from '@chesspecker/api-definitions';
import { Injectable } from '@nestjs/common';

import { ForbiddenException } from '../../../shared/exception/forbidden.exception';
import { PreconditionFailedException } from '../../../shared/exception/precondition-failed.exception';
import { ListFriendsUseCase } from '../../friendship/use-case/list-friends.use-case';
import { UserNotificationType } from '../../notification/definition/user-notification-type.enum';
import { CreateNotificationsUseCase } from '../../notification/use-case/create-notifications.use-case';
import { PuzzleRepository } from '../../puzzle/puzzle.repository';
import { PuzzleAttempt } from '../../training/puzzle-attempt.entity';
import { PuzzleAttemptRepository } from '../../training/puzzle-attempt.repository';
import { User } from '../../user/user.entity';
import { CreatePuzzleShareRequestDto } from '../dto/request/create-puzzle-share-request.dto';
import { PuzzleShareAttempt } from '../puzzle-share-attempt.entity';
import { PuzzleShareRecipient } from '../puzzle-share-recipient.entity';
import { PuzzleShare } from '../puzzle-share.entity';
import { PuzzleShareRepository } from '../puzzle-share.repository';
import { buildAttempt } from '../util/puzzle-share.util';

import { PresentPuzzleSharesUseCase } from './present-puzzle-shares.use-case';

@Injectable()
export class CreatePuzzleShareUseCase {
	constructor(
		private readonly puzzleShareRepository: PuzzleShareRepository,
		private readonly puzzleRepository: PuzzleRepository,
		private readonly puzzleAttemptRepository: PuzzleAttemptRepository,
		private readonly listFriendsUseCase: ListFriendsUseCase,
		private readonly createNotificationsUseCase: CreateNotificationsUseCase,
		private readonly presentPuzzleSharesUseCase: PresentPuzzleSharesUseCase,
	) {}

	/**
	 * An exercise outside the catalogue answers 404, like filing a bookmark on one does: a
	 * challenge nobody else can open is not worth sending.
	 */
	async execute(sender: User, request: CreatePuzzleShareRequestDto): Promise<PuzzleShareResponse> {
		const puzzle = await this.puzzleRepository.getOne({ lichessId: request.lichessId });
		const recipients = await this.resolveRecipients(sender, request.recipientUuids);
		const sourceAttempt = await this.findSourceAttempt(sender, request.attemptUuid);

		const share = new PuzzleShare({
			sender,
			puzzle,
			...(undefined === request.message ? {} : { message: request.message }),
			...(undefined === sourceAttempt ? {} : { sourceAttempt }),
		});

		await this.puzzleShareRepository.insertChallenge(
			share,
			recipients.map((recipient) => new PuzzleShareRecipient({ share, recipient })),
			this.buildSenderAttempt(share, sender, request),
		);

		await this.notify(share, sender, recipients);

		return this.presentPuzzleSharesUseCase.executeOne(share);
	}

	/**
	 * Only friends, and never yourself. A uuid that is not on the list is refused without
	 * saying whether it belongs to anybody: the answer would be a lookup on its own.
	 */
	private async resolveRecipients(sender: User, uuids: readonly string[]): Promise<User[]> {
		const wanted = new Set(uuids);

		if (wanted.has(sender.uuid)) {
			throw new PreconditionFailedException('cannot be yourself', 'recipientUuids');
		}

		const chosen = (await this.listFriendsUseCase.execute(sender)).filter((friend) =>
			wanted.has(friend.uuid),
		);

		if (chosen.length !== wanted.size) {
			throw new ForbiddenException('not a friend', 'recipientUuids');
		}

		return chosen;
	}

	/**
	 * The device names an attempt it may not have pushed yet, and one it pushed may have been
	 * cancelled since: an unknown uuid leaves the challenge without a pointer rather than
	 * refusing it, because the numbers travel separately anyway.
	 */
	private async findSourceAttempt(
		sender: User,
		uuid: string | undefined,
	): Promise<PuzzleAttempt | undefined> {
		if (undefined === uuid) {
			return undefined;
		}

		const attempts = await this.puzzleAttemptRepository.getMany(
			{ uuid, training: { user: sender.uuid } },
			{ limit: 1 },
		);

		return attempts[0];
	}

	/** The sender answered before anybody was asked, so their row is written with the share. */
	private buildSenderAttempt(
		share: PuzzleShare,
		sender: User,
		request: CreatePuzzleShareRequestDto,
	): PuzzleShareAttempt | undefined {
		const result = request.result;

		if (undefined === result) {
			return undefined;
		}

		return buildAttempt(share, sender, result);
	}

	private async notify(
		share: PuzzleShare,
		sender: User,
		recipients: readonly User[],
	): Promise<void> {
		await this.createNotificationsUseCase.execute(
			recipients.map((recipient) => ({
				user: recipient,
				type: UserNotificationType.PuzzleShareReceived,
				actor: sender,
				share,
			})),
		);
	}
}
