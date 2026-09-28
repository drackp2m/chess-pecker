import { MatchStatus, PieceColor } from '@app/definition/chess.type';

export type MatchOpponentModel = 'legacy' | 'stockfish';

export type MatchPhase = MatchStatus | 'resigned' | 'agreed';

export interface MatchSnapshot {
	readonly startFen: string;
	readonly moves: readonly string[];
	readonly playerColor: PieceColor;
	readonly opponentModel: MatchOpponentModel;
	readonly stockfishElo: number;
	readonly orientation: PieceColor;
	readonly status: MatchPhase;
}
