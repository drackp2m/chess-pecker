import { BoardTransition } from '@app/definition/board-animation.type';
import {
	ChessMove,
	ChessMoveRecord,
	ChessPosition,
	PieceColor,
	Square,
} from '@app/definition/chess.type';
import type { TranslationRef } from '@app/definition/i18n.type';
import { MatchOpponentModel, MatchPhase, MatchSnapshot } from '@app/definition/match.type';
import { STOCKFISH_ELO_LEVELS } from '@app/page/match/service/stockfish-opponent.service';
import type { StockfishElo } from '@app/page/match/service/stockfish-opponent.service';
import { ChessBoard } from '@app/util/chess/chess-board';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessMoveGenerator } from '@app/util/chess/chess-move-generator';
import { ChessNotation } from '@app/util/chess/chess-notation';

export interface PendingPromotion {
	readonly from: Square;
	readonly to: Square;
}

export interface MatchLine {
	readonly positions: readonly ChessPosition[];
	readonly moves: readonly ChessMoveRecord[];
	readonly cursor: number;
}

export interface MatchStoreProps {
	positions: readonly ChessPosition[];
	moves: readonly ChessMoveRecord[];
	cursor: number;
	exploration: MatchLine | undefined;
	playerColor: PieceColor;
	opponentModel: MatchOpponentModel;
	stockfishElo: StockfishElo;
	orientation: PieceColor;
	selected: Square | undefined;
	pendingPromotion: PendingPromotion | undefined;
	announced: ChessMove | undefined;
	transition: BoardTransition | undefined;
	status: MatchPhase;
	drawOfferedAt: number | undefined;
	isOpponentThinking: boolean;
	notationError: TranslationRef | undefined;
}

const DEFAULT_ELO: StockfishElo = 2300;

export function buildInitialState(
	playerColor: PieceColor = 'white',
	start: ChessPosition = ChessFen.initial(),
): MatchStoreProps {
	return {
		positions: [start],
		moves: [],
		cursor: 0,
		exploration: undefined,
		playerColor,
		opponentModel: 'legacy',
		stockfishElo: DEFAULT_ELO,
		orientation: playerColor,
		selected: undefined,
		pendingPromotion: undefined,
		announced: undefined,
		transition: undefined,
		status: 'idle',
		drawOfferedAt: undefined,
		isOpponentThinking: false,
		notationError: undefined,
	};
}

export function positionAt(line: MatchLine): ChessPosition {
	return line.positions[line.cursor] ?? line.positions.at(-1) ?? ChessFen.initial();
}

export function playOnLine(line: MatchLine, move: ChessMove): MatchLine {
	const position = positionAt(line);
	const record: ChessMoveRecord = {
		...move,
		san: ChessNotation.describe(position, move),
		fullmoveNumber: position.fullmoveNumber,
	};

	return {
		positions: [...line.positions.slice(0, line.cursor + 1), ChessBoard.apply(position, move)],
		moves: [...line.moves.slice(0, line.cursor), record],
		cursor: line.cursor + 1,
	};
}

export function lineStatus(positions: readonly ChessPosition[]): MatchPhase {
	const position = positions.at(-1) ?? ChessFen.initial();

	return ChessMoveGenerator.status(position, positions.slice(0, -1));
}

export function replayLine(start: ChessPosition, notations: readonly string[]): MatchLine {
	let line: MatchLine = { positions: [start], moves: [], cursor: 0 };

	for (const notation of notations) {
		const move = ChessNotation.parse(positionAt(line), notation);

		if (undefined === move) {
			break;
		}

		line = playOnLine(line, move);
	}

	return line;
}

export function restoredState(snapshot: MatchSnapshot): MatchStoreProps {
	const start = ChessFen.isValid(snapshot.startFen)
		? ChessFen.parse(snapshot.startFen)
		: ChessFen.initial();
	const line = replayLine(start, snapshot.moves);
	const isSettled = 'idle' === snapshot.status || isAgreedEnding(snapshot.status);

	return {
		...buildInitialState(snapshot.playerColor, start),
		positions: line.positions,
		moves: line.moves,
		cursor: line.moves.length,
		opponentModel: snapshot.opponentModel,
		stockfishElo: normalizeElo(snapshot.stockfishElo),
		orientation: snapshot.orientation,
		status: isSettled ? snapshot.status : lineStatus(line.positions),
	};
}

export function snapshotOf(state: {
	readonly positions: readonly ChessPosition[];
	readonly moves: readonly ChessMoveRecord[];
	readonly playerColor: PieceColor;
	readonly opponentModel: MatchOpponentModel;
	readonly stockfishElo: StockfishElo;
	readonly orientation: PieceColor;
	readonly status: MatchPhase;
}): MatchSnapshot {
	return {
		startFen: ChessFen.serialize(state.positions[0] ?? ChessFen.initial()),
		moves: state.moves.map((move) => ChessNotation.describeLong(move)),
		playerColor: state.playerColor,
		opponentModel: state.opponentModel,
		stockfishElo: state.stockfishElo,
		orientation: state.orientation,
		status: state.status,
	};
}

export function isAgreedEnding(status: MatchPhase): boolean {
	return 'resigned' === status || 'agreed' === status;
}

function normalizeElo(elo: number): StockfishElo {
	return STOCKFISH_ELO_LEVELS.find((level) => level === elo) ?? DEFAULT_ELO;
}
