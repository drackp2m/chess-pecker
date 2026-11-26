import { CycleDifficulty } from '@app/definition/cycle-difficulty.constant';
import { Generate } from '@app/util/generate';
import { shuffle } from '@app/util/shuffle';

export interface CycleCandidate<T> {
	readonly item: T;
	readonly score: number;
	readonly themes: readonly string[];
}

interface Ranked<T> {
	readonly item: T;
	readonly themes: ReadonlySet<string>;
}

const IGNORED_THEMES: ReadonlySet<string> = new Set(CycleDifficulty.ignoredThemes);

export function buildCycleOrder<T>(candidates: readonly CycleCandidate<T>[]): T[] {
	const ranked = candidates
		.map((candidate) => ({ candidate, key: candidate.score + jitter() }))
		.sort((one, other) => one.key - other.key)
		.map(({ candidate }) => ({ item: candidate.item, themes: relevantThemes(candidate.themes) }));
	const recent: ReadonlySet<string>[] = [];

	return toTiers(ranked).flatMap((tier) =>
		interleave(shuffle(tier), recent).map((entry) => entry.item),
	);
}

export function themeSimilarity(one: ReadonlySet<string>, other: ReadonlySet<string>): number {
	const shared = [...one].filter((theme) => other.has(theme)).length;
	const union = one.size + other.size - shared;

	return 0 === union ? 0 : shared / union;
}

function jitter(): number {
	return Generate.randomNumber(-CycleDifficulty.jitter, CycleDifficulty.jitter);
}

function relevantThemes(themes: readonly string[]): ReadonlySet<string> {
	return new Set(themes.filter((theme) => !IGNORED_THEMES.has(theme)));
}

function toTiers<T>(ranked: readonly Ranked<T>[]): Ranked<T>[][] {
	const size = CycleDifficulty.tierSize;

	return Array.from({ length: Math.ceil(ranked.length / size) }, (_unused, index) =>
		ranked.slice(index * size, (index + 1) * size),
	);
}

function interleave<T>(tier: readonly Ranked<T>[], recent: ReadonlySet<string>[]): Ranked<T>[] {
	const pool = [...tier];
	const placed: Ranked<T>[] = [];

	while (0 < pool.length) {
		const window = pool.slice(0, CycleDifficulty.varietyWindow);
		const [next] = pool.splice(leastSimilar(window, recent), 1);

		if (undefined === next) {
			break;
		}

		placed.push(next);
		recent.unshift(next.themes);
		recent.splice(CycleDifficulty.varietyMemory.length);
	}

	return placed;
}

function leastSimilar<T>(
	window: readonly Ranked<T>[],
	recent: readonly ReadonlySet<string>[],
): number {
	let best = 0;
	let bestPenalty = Number.POSITIVE_INFINITY;

	for (const [index, entry] of window.entries()) {
		const penalty = similarityPenalty(entry.themes, recent);

		if (penalty < bestPenalty) {
			best = index;
			bestPenalty = penalty;
		}
	}

	return best;
}

function similarityPenalty(
	themes: ReadonlySet<string>,
	recent: readonly ReadonlySet<string>[],
): number {
	return recent.reduce(
		(total, previous, index) =>
			total + (CycleDifficulty.varietyMemory[index] ?? 0) * themeSimilarity(themes, previous),
		0,
	);
}
