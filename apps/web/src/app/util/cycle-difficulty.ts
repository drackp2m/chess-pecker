import type { PuzzleBookmarkType } from '@chesspecker/api-definitions';

import { CycleDifficulty } from '@app/definition/cycle-difficulty.constant';
import { PuzzleStructure } from '@app/util/puzzle-structure';

export interface PreviousAttempt {
	readonly solved: boolean;
	readonly hintUsed: boolean;
	readonly mistakeCount: number;
	readonly durationMs: number;
}

export interface DifficultyInput {
	readonly rating: number;
	readonly structure: PuzzleStructure;
	readonly bookmark?: PuzzleBookmarkType | undefined;
	readonly attempt?: PreviousAttempt | undefined;
	readonly medianMs?: number | undefined;
}

export function difficultyScore(input: DifficultyInput): number {
	return (
		input.rating +
		structureScore(input.structure) +
		bookmarkScore(input.bookmark) +
		historyScore(input.attempt, input.medianMs)
	);
}

export function median(values: readonly number[]): number | undefined {
	const sorted = [...values].sort((one, other) => one - other);
	const middle = Math.floor(sorted.length / 2);

	if (0 === sorted.length) {
		return undefined;
	}

	return 0 === sorted.length % 2
		? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
		: sorted[middle];
}

function structureScore({ playerMoves, isQuietStart, material }: PuzzleStructure): number {
	const weights = CycleDifficulty.structure;
	const extraPieces = Math.max(0, material - weights.materialBase);

	return (
		Math.max(0, playerMoves - 1) * weights.perExtraMove +
		(isQuietStart ? weights.quietStart : 0) +
		Math.min(weights.maxMaterial, extraPieces * weights.perExtraPiece)
	);
}

function bookmarkScore(bookmark: PuzzleBookmarkType | undefined): number {
	return undefined === bookmark ? 0 : CycleDifficulty.bookmark[bookmark];
}

function historyScore(attempt: PreviousAttempt | undefined, medianMs: number | undefined): number {
	if (undefined === attempt) {
		return 0;
	}

	const weights = CycleDifficulty.history;
	const ratio = undefined === medianMs || 0 >= medianMs ? 1 : attempt.durationMs / medianMs;

	if (isFastAndClean(attempt, ratio)) {
		return weights.fastAndClean;
	}

	return (
		(attempt.solved ? 0 : weights.failed) +
		(attempt.hintUsed ? weights.hintUsed : 0) +
		Math.min(weights.maxMistakes, attempt.mistakeCount * weights.perMistake) +
		Math.min(weights.maxSlowness, Math.max(0, (ratio - 1) * weights.maxSlowness))
	);
}

function isFastAndClean(attempt: PreviousAttempt, ratio: number): boolean {
	return (
		attempt.solved &&
		!attempt.hintUsed &&
		0 === attempt.mistakeCount &&
		ratio <= CycleDifficulty.history.fastRatio
	);
}
