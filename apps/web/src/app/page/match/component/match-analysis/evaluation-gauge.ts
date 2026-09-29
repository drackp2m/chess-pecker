import { ChessPosition, MatchStatus, PieceColor } from '@app/definition/chess.type';
import { EngineEvaluation } from '@app/page/match/service/engine-evaluation';

const EVEN_SHARE = 50;
const FULL_SHARE = 100;
const SHARE_MARGIN = 5;
const CENTIPAWN_CAP = 1000;
const CENTIPAWN_SLOPE = 0.00368208;

export interface GaugeReading {
	readonly whiteShare: number;
	readonly leader: PieceColor;
	readonly label: string | undefined;
}

export function readGauge(
	status: MatchStatus,
	position: ChessPosition,
	evaluation: EngineEvaluation | undefined,
): GaugeReading {
	if ('checkmate' === status) {
		return 'white' === position.turn
			? { whiteShare: 0, leader: 'black', label: '0-1' }
			: { whiteShare: FULL_SHARE, leader: 'white', label: '1-0' };
	}

	if ('playing' !== status) {
		return { whiteShare: EVEN_SHARE, leader: 'white', label: '½-½' };
	}

	if (undefined === evaluation) {
		return { whiteShare: EVEN_SHARE, leader: 'white', label: undefined };
	}

	return 'mate' === evaluation.score.unit
		? readMate(evaluation.score.value)
		: readCentipawns(evaluation.score.value);
}

function readMate(moves: number): GaugeReading {
	const leader: PieceColor = 0 < moves ? 'white' : 'black';

	return {
		whiteShare: 'white' === leader ? FULL_SHARE : 0,
		leader,
		label: `M${String(Math.abs(moves))}`,
	};
}

function readCentipawns(centipawns: number): GaugeReading {
	const tenths = Math.round(centipawns / 10);
	const capped = Math.max(-CENTIPAWN_CAP, Math.min(CENTIPAWN_CAP, centipawns));
	const winning = 2 / (1 + Math.exp(-CENTIPAWN_SLOPE * capped)) - 1;
	const share = EVEN_SHARE + EVEN_SHARE * winning;

	return {
		whiteShare: Math.max(SHARE_MARGIN, Math.min(FULL_SHARE - SHARE_MARGIN, share)),
		leader: 0 > tenths ? 'black' : 'white',
		label: 0 === tenths ? '0.0' : `+${(Math.abs(tenths) / 10).toFixed(1)}`,
	};
}
