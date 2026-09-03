import type {
	PuzzleShareParticipant,
	PuzzleShare as PuzzleShareResponse,
	PuzzleShareResult,
	PuzzleShareResultRequest,
} from '@chesspecker/api-definitions';

import { toIsoDate } from '../../../shared/util/to-iso-date';
import { PuzzleAttemptClosure } from '../../training/definition/puzzle-attempt-closure.enum';
import { User } from '../../user/user.entity';
import { PuzzleShareAttempt } from '../puzzle-share-attempt.entity';
import { PuzzleShareRecipient } from '../puzzle-share-recipient.entity';
import { PuzzleShare } from '../puzzle-share.entity';

export function presentResult(attempt: PuzzleShareAttempt): PuzzleShareResult {
	return {
		uuid: attempt.uuid,
		solved: attempt.solved,
		closure: attempt.closure,
		hintUsed: attempt.hintUsed,
		mistakeCount: attempt.mistakeCount,
		...(undefined === attempt.durationMs ? {} : { durationMs: attempt.durationMs }),
		createdAt: toIsoDate(attempt.createdAt),
	};
}

function presentParticipant(
	user: User,
	attempts: ReadonlyMap<string, PuzzleShareAttempt>,
): PuzzleShareParticipant {
	const attempt = attempts.get(user.uuid);

	return {
		user: { uuid: user.uuid, username: user.username },
		result: undefined === attempt ? null : presentResult(attempt),
	};
}

/**
 * The sender is presented as one participant among the others rather than beside them: a
 * challenge is read as a table of who did what, and they are one of its rows.
 */
export function presentShare(
	share: PuzzleShare,
	recipients: readonly PuzzleShareRecipient[],
	attempts: readonly PuzzleShareAttempt[],
): PuzzleShareResponse {
	const byUser = new Map(attempts.map((attempt) => [attempt.user.uuid, attempt]));

	return {
		uuid: share.uuid,
		lichessId: share.puzzle.lichessId,
		message: share.message ?? null,
		sender: presentParticipant(share.sender, byUser),
		recipients: recipients.map((row) => presentParticipant(row.recipient, byUser)),
		createdAt: toIsoDate(share.createdAt),
		updatedAt: toIsoDate(share.updatedAt),
	};
}

/**
 * The verdict as it goes in, field by field: the request is a class instance, and spreading
 * one hands the entity its prototype along with the numbers.
 */
export function buildAttempt(
	share: PuzzleShare,
	user: User,
	result: PuzzleShareResultRequest,
): PuzzleShareAttempt {
	return new PuzzleShareAttempt({
		share,
		user,
		solved: result.solved,
		closure: result.closure as PuzzleAttemptClosure,
		hintUsed: result.hintUsed,
		mistakeCount: result.mistakeCount,
		...(undefined === result.durationMs ? {} : { durationMs: result.durationMs }),
	});
}
