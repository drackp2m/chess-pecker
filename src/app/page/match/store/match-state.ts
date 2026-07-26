import {
	ChessMoveRecord,
	ChessPosition,
	MatchStatus,
	PieceColor,
	Square,
} from '@app/definition/chess.type';
import { ChessFen } from '@app/util/chess/chess-fen';

export interface PendingPromotion {
	readonly from: Square;
	readonly to: Square;
}

export interface MatchStoreProps {
	position: ChessPosition;
	/** Snapshot taken *before* each played move, so undo is a plain pop. */
	positionHistory: ChessPosition[];
	history: ChessMoveRecord[];
	playerColor: PieceColor;
	orientation: PieceColor;
	selected: Square | undefined;
	pendingPromotion: PendingPromotion | undefined;
	status: MatchStatus;
	isOpponentThinking: boolean;
	notationError: string | undefined;
}

export interface Rewind {
	readonly position: ChessPosition;
	readonly positionHistory: ChessPosition[];
	readonly history: ChessMoveRecord[];
}

export function buildInitialState(playerColor: PieceColor = 'white'): MatchStoreProps {
	return {
		position: ChessFen.initial(),
		positionHistory: [],
		history: [],
		playerColor,
		orientation: playerColor,
		selected: undefined,
		pendingPromotion: undefined,
		status: 'playing',
		isOpponentThinking: false,
		notationError: undefined,
	};
}

/**
 * Walks the snapshots back until it is the player's turn again, which undoes the
 * machine's reply together with the player's own move.
 */
export function rewindToPlayerTurn(current: Rewind, playerColor: PieceColor): Rewind {
	const positionHistory = [...current.positionHistory];
	let history = [...current.history];
	let position = current.position;

	while (0 < positionHistory.length) {
		position = positionHistory.pop() ?? position;
		history = history.slice(0, -1);

		if (position.turn === playerColor) {
			break;
		}
	}

	return { position, positionHistory, history };
}
