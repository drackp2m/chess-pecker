import type { PuzzleShareParticipant, PuzzleShareResult } from '@chesspecker/api-definitions';
import { describe, expect, it } from 'vitest';

import { ShareRow } from '@app/repository/definition/share-schema.interface';
import { answeredCount, hasAnswered, rankStandings, verdictOf } from '@app/util/challenge-standing';

function result(overrides: Partial<PuzzleShareResult> = {}): PuzzleShareResult {
	return {
		uuid: 'result',
		solved: true,
		closure: 'found',
		hintUsed: false,
		mistakeCount: 0,
		createdAt: '2026-11-20T10:00:00.000Z',
		...overrides,
	};
}

function participant(
	username: string,
	answer: PuzzleShareResult | null = null,
): PuzzleShareParticipant {
	return { user: { uuid: `uuid-${username}`, username }, result: answer };
}

function share(
	sender: PuzzleShareParticipant,
	recipients: readonly PuzzleShareParticipant[],
): ShareRow {
	return {
		uuid: 'share',
		lichessId: 'abc12',
		message: null,
		sender,
		recipients,
		createdAt: new Date('2026-11-20T09:00:00.000Z'),
		updatedAt: new Date('2026-11-20T09:00:00.000Z'),
	};
}

function order(row: ShareRow): string[] {
	return rankStandings(row).map(
		({ participant: entry, position }) => `${entry.user.username}:${String(position)}`,
	);
}

describe('verdictOf', () => {
	it('tells a clean solve, a solve after a miss and a revealed line apart', () => {
		expect(verdictOf(result())).toBe('solved');
		expect(verdictOf(result({ solved: false }))).toBe('recovered');
		expect(verdictOf(result({ solved: false, closure: 'revealed' }))).toBe('revealed');
	});
});

describe('rankStandings', () => {
	it('puts the verdict first, then the hint, the mistakes and the time', () => {
		const row = share(participant('ana', result({ mistakeCount: 1, solved: false })), [
			participant('bea', result({ closure: 'revealed', solved: false })),
			participant('carla', result({ hintUsed: true })),
			participant('dani', result({ durationMs: 9000 })),
			participant('eva', result({ durationMs: 4000 })),
		]);

		expect(order(row)).toEqual(['eva:1', 'dani:2', 'carla:3', 'ana:4', 'bea:5']);
	});

	it('shares the position on a tie and leaves the next one out', () => {
		const row = share(participant('ana', result()), [
			participant('bea', result({ createdAt: '2026-11-21T10:00:00.000Z' })),
			participant('carla', result({ mistakeCount: 2, solved: false })),
		]);

		expect(order(row)).toEqual(['ana:1', 'bea:1', 'carla:3']);
	});

	it('ranks a timed answer ahead of an untimed one with the same numbers', () => {
		const row = share(participant('ana', result()), [
			participant('bea', result({ durationMs: 20000 })),
		]);

		expect(order(row)).toEqual(['bea:1', 'ana:2']);
	});

	it('leaves whoever has not answered at the end, without a position', () => {
		const row = share(participant('ana', result()), [
			participant('bea'),
			participant('carla', result()),
		]);

		expect(order(row)).toEqual(['ana:1', 'carla:1', 'bea:null']);
		expect(rankStandings(row)[0]?.isSender).toBe(true);
	});
});

describe('answers', () => {
	const row = share(participant('ana', result()), [
		participant('bea'),
		participant('carla', result()),
	]);

	it('counts only the recipients who answered', () => {
		expect(answeredCount(row)).toBe(1);
	});

	it('knows whether the account has answered', () => {
		expect(hasAnswered(row, 'uuid-carla')).toBe(true);
		expect(hasAnswered(row, 'uuid-bea')).toBe(false);
		expect(hasAnswered(row, 'uuid-zoe')).toBe(false);
		expect(hasAnswered(row, null)).toBe(false);
	});
});
