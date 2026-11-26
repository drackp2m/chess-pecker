import type { PuzzleShareParticipant, PuzzleShareResult } from '@chesspecker/api-definitions';

import { ChallengeVerdict } from '@app/definition/challenge.type';
import { ShareRow } from '@app/repository/definition/share-schema.interface';

export interface ChallengeStanding {
	readonly participant: PuzzleShareParticipant;
	readonly isSender: boolean;
	readonly position: number | null;
}

interface AnsweredEntry {
	readonly participant: PuzzleShareParticipant;
	readonly result: PuzzleShareResult;
	readonly isSender: boolean;
}

const VERDICT_RANK: Record<ChallengeVerdict, number> = {
	solved: 0,
	recovered: 1,
	revealed: 2,
};

export function verdictOf(result: PuzzleShareResult): ChallengeVerdict {
	if ('revealed' === result.closure) {
		return 'revealed';
	}

	return result.solved ? 'solved' : 'recovered';
}

export function participantOf(
	share: ShareRow,
	userUuid: string | null,
): PuzzleShareParticipant | undefined {
	if (null === userUuid) {
		return undefined;
	}

	return [share.sender, ...share.recipients].find(
		(participant) => participant.user.uuid === userUuid,
	);
}

export function hasAnswered(share: ShareRow, userUuid: string | null): boolean {
	return null !== (participantOf(share, userUuid)?.result ?? null);
}

export function answeredCount(share: ShareRow): number {
	return share.recipients.filter((participant) => null !== participant.result).length;
}

export function compareResults(one: PuzzleShareResult, other: PuzzleShareResult): number {
	return firstDifference([
		VERDICT_RANK[verdictOf(one)] - VERDICT_RANK[verdictOf(other)],
		Number(one.hintUsed) - Number(other.hintUsed),
		one.mistakeCount - other.mistakeCount,
		compareDurations(one.durationMs, other.durationMs),
	]);
}

export function rankStandings(share: ShareRow): ChallengeStanding[] {
	const everyone = [
		{ participant: share.sender, isSender: true },
		...share.recipients.map((participant) => ({ participant, isSender: false })),
	];
	const answered = everyone
		.flatMap(({ participant, isSender }) =>
			null === participant.result ? [] : [{ participant, result: participant.result, isSender }],
		)
		.sort(compareEntries);
	const pending = everyone.filter(({ participant }) => null === participant.result);

	return [
		...answered.map((entry, index) => ({
			participant: entry.participant,
			isSender: entry.isSender,
			position: positionAt(answered, index),
		})),
		...pending.map((entry) => ({ ...entry, position: null })),
	];
}

function compareEntries(one: AnsweredEntry, other: AnsweredEntry): number {
	return firstDifference([
		compareResults(one.result, other.result),
		one.result.createdAt.localeCompare(other.result.createdAt),
	]);
}

function firstDifference(differences: readonly number[]): number {
	return differences.find((difference) => 0 !== difference) ?? 0;
}

function positionAt(sorted: readonly AnsweredEntry[], index: number): number {
	let position = index;

	while (0 < position) {
		const previous = sorted[position - 1];
		const current = sorted[position];

		if (undefined === previous || undefined === current) {
			break;
		}

		if (0 !== compareResults(previous.result, current.result)) {
			break;
		}

		position -= 1;
	}

	return position + 1;
}

function compareDurations(one: number | undefined, other: number | undefined): number {
	if (undefined === one || undefined === other) {
		return Number(undefined === one) - Number(undefined === other);
	}

	return one - other;
}
