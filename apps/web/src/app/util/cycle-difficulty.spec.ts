import { describe, expect, it } from 'vitest';

import { PreviousAttempt, difficultyScore, median } from '@app/util/cycle-difficulty';
import { PuzzleStructure } from '@app/util/puzzle-structure';

const PLAIN: PuzzleStructure = { playerMoves: 1, isQuietStart: false, material: 0 };

const CLEAN: PreviousAttempt = {
	solved: true,
	hintUsed: false,
	mistakeCount: 0,
	durationMs: 10_000,
};

describe('difficultyScore', () => {
	it('is the rating alone for a one-move forcing exercise with no history', () => {
		expect(difficultyScore({ rating: 1234, structure: PLAIN })).toBe(1234);
	});

	it('weighs a longer line, a quiet first move and a crowded board', () => {
		const plain = difficultyScore({ rating: 1200, structure: PLAIN });
		const longer = difficultyScore({ rating: 1200, structure: { ...PLAIN, playerMoves: 3 } });
		const quiet = difficultyScore({ rating: 1200, structure: { ...PLAIN, isQuietStart: true } });
		const crowded = difficultyScore({ rating: 1200, structure: { ...PLAIN, material: 14 } });

		expect(longer).toBeGreaterThan(plain);
		expect(quiet).toBeGreaterThan(plain);
		expect(crowded).toBeGreaterThan(plain);
	});

	it('ranks unclear above hard, hard above nothing and easy below it', () => {
		const score = (bookmark?: 'easy' | 'hard' | 'unclear') =>
			difficultyScore({ rating: 1200, structure: PLAIN, bookmark });

		expect(score('unclear')).toBeGreaterThan(score('hard'));
		expect(score('hard')).toBeGreaterThan(score());
		expect(score()).toBeGreaterThan(score('easy'));
	});

	it('pushes back what failed, needed the hint or took mistakes last time', () => {
		const base = { rating: 1200, structure: PLAIN, medianMs: 10_000 };
		const clean = difficultyScore({ ...base, attempt: CLEAN });

		expect(difficultyScore({ ...base, attempt: { ...CLEAN, solved: false } })).toBeGreaterThan(
			clean,
		);
		expect(difficultyScore({ ...base, attempt: { ...CLEAN, hintUsed: true } })).toBeGreaterThan(
			clean,
		);
		expect(difficultyScore({ ...base, attempt: { ...CLEAN, mistakeCount: 2 } })).toBeGreaterThan(
			clean,
		);
	});

	it('pushes back what took far longer than usual', () => {
		const base = { rating: 1200, structure: PLAIN, medianMs: 10_000 };

		expect(difficultyScore({ ...base, attempt: { ...CLEAN, durationMs: 30_000 } })).toBeGreaterThan(
			difficultyScore({ ...base, attempt: CLEAN }),
		);
	});

	it('brings forward what was solved fast and clean', () => {
		const base = { rating: 1200, structure: PLAIN, medianMs: 10_000 };

		expect(difficultyScore({ ...base, attempt: { ...CLEAN, durationMs: 3_000 } })).toBeLessThan(
			1200,
		);
	});
});

describe('median', () => {
	it('has none for no values', () => {
		expect(median([])).toBeUndefined();
	});

	it('takes the middle value of an odd count', () => {
		expect(median([30, 10, 20])).toBe(20);
	});

	it('averages the two middle values of an even count', () => {
		expect(median([40, 10, 30, 20])).toBe(25);
	});
});
