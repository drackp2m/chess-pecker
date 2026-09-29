import type { ChessPosition } from '@app/definition/chess.type';
import { ChessMoveGenerator } from '@app/util/chess/chess-move-generator';
import { ChessNotation } from '@app/util/chess/chess-notation';

export const NATIVE_ELO_FLOOR = 1320;

const HUMANIZED_ELO_FLOOR = 500;

const MATE_SCORE = 100_000;

const INFO_PATTERN =
	/\bmultipv (\d+) score (cp|mate) (-?\d+)(?!\d| (?:lower|upper)bound).* pv (\S+)/;

export interface HumanizedProfile {
	readonly depth: number;
	readonly candidates: number;
	readonly temperature: number;
	readonly blunderChance: number;
}

export interface EngineCandidate {
	readonly move: string;
	readonly score: number;
}

export function humanizedProfile(elo: number): HumanizedProfile {
	const skill = Math.min(
		1,
		Math.max(0, (elo - HUMANIZED_ELO_FLOOR) / (NATIVE_ELO_FLOOR - HUMANIZED_ELO_FLOOR)),
	);

	return {
		depth: Math.round(1 + 5 * skill),
		candidates: Math.round(8 - 4 * skill),
		temperature: 350 - 290 * skill,
		blunderChance: 0.3 - 0.27 * skill,
	};
}

export function readCandidates(lines: readonly string[]): EngineCandidate[] {
	const byRank = new Map<string, EngineCandidate>();

	for (const line of lines) {
		const [, rank, unit, value, move] = INFO_PATTERN.exec(line) ?? [];

		if (undefined === rank || undefined === move) {
			continue;
		}

		byRank.set(rank, { move, score: toCentipawns(unit, Number(value)) });
	}

	return [...byRank.values()];
}

export function pickHumanizedMove(
	position: ChessPosition,
	candidates: readonly EngineCandidate[],
	profile: HumanizedProfile,
	random: () => number = Math.random,
): string | undefined {
	if (0 === candidates.length || random() < profile.blunderChance) {
		return randomLegalMove(position, random);
	}

	const best = Math.max(...candidates.map(({ score }) => score));
	const weights = candidates.map(({ score }) => Math.exp((score - best) / profile.temperature));
	let threshold = random() * weights.reduce((total, weight) => total + weight, 0);

	for (const [index, candidate] of candidates.entries()) {
		threshold -= weights[index] ?? 0;

		if (0 >= threshold) {
			return candidate.move;
		}
	}

	return candidates.at(-1)?.move;
}

function toCentipawns(unit: string | undefined, value: number): number {
	if ('mate' !== unit) {
		return value;
	}

	return 0 < value ? MATE_SCORE - value : -MATE_SCORE - value;
}

function randomLegalMove(position: ChessPosition, random: () => number): string | undefined {
	const moves = ChessMoveGenerator.legalMoves(position);
	const move = moves[Math.floor(random() * moves.length)];

	return undefined === move ? undefined : ChessNotation.describeLong(move);
}
