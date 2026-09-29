import { ChessPosition } from '@app/definition/chess.type';

const INFO_PATTERN = /^info depth (\d+) .*?\bscore (cp|mate) (-?\d+)(?!\d| (?:lower|upper)bound)/;

export interface EngineScore {
	readonly unit: 'cp' | 'mate';
	readonly value: number;
}

export interface EngineEvaluation {
	readonly fen: string;
	readonly depth: number;
	readonly score: EngineScore;
}

export function readEvaluation(
	position: ChessPosition,
	fen: string,
	info: string,
): EngineEvaluation | undefined {
	const [, depth, unit, value] = INFO_PATTERN.exec(info) ?? [];

	if (undefined === depth || undefined === value) {
		return undefined;
	}

	const perspective = 'white' === position.turn ? 1 : -1;

	return {
		fen,
		depth: Number(depth),
		score: { unit: 'mate' === unit ? 'mate' : 'cp', value: perspective * Number(value) },
	};
}
