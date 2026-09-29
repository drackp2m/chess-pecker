import { PIECE_VALUE } from '@app/definition/chess.constant';
import { ChessMoveRecord, PieceColor, PieceType } from '@app/definition/chess.type';

const PIECE_ORDER: readonly PieceType[] = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];

export interface CapturedGroup {
	readonly type: PieceType;
	readonly pieces: readonly PieceType[];
}

export function capturedBy(
	history: readonly ChessMoveRecord[],
	color: PieceColor,
): CapturedGroup[] {
	const counts = new Map<PieceType, number>();

	for (const move of history) {
		if (color === move.color && undefined !== move.captured) {
			counts.set(move.captured, (counts.get(move.captured) ?? 0) + 1);
		}
	}

	return PIECE_ORDER.filter((type) => counts.has(type))
		.sort((first, second) => PIECE_VALUE[first] - PIECE_VALUE[second])
		.map((type) => ({ type, pieces: Array.from({ length: counts.get(type) ?? 0 }, () => type) }));
}

export function materialOf(groups: readonly CapturedGroup[]): number {
	return groups.reduce((total, group) => total + PIECE_VALUE[group.type] * group.pieces.length, 0);
}
