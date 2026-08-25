import {
	BoardSlideStep,
	BoardStage,
	BoardTransition,
	BoardTransitionKind,
} from '@app/definition/board-animation.type';
import { BOARD_SIZE } from '@app/definition/chess.constant';
import { CastlingSide, ChessMove, ChessPosition } from '@app/definition/chess.type';
import { MoveSound } from '@app/definition/sound.type';
import { ChessBoard } from '@app/util/chess/chess-board';
import { ChessCastling } from '@app/util/chess/chess-castling';
import { ChessMoveGenerator } from '@app/util/chess/chess-move-generator';
import { ChessSquare } from '@app/util/chess/chess-square';

/** A stage before it knows which way it runs, or which tick it will be given. */
type StagePlan = Pick<BoardStage, 'slides' | 'board' | 'sound'>;

/**
 * Board events so far, counted here and not in a store on purpose: a tick may never come
 * round twice, and a store clears its transition whenever the board jumps.
 */
let lastTick = 0;

/**
 * Builds the transition for a board event. `position` is the board the move is played from
 * either way round: a take-back runs the very same stages backwards.
 */
export function nextTransition(
	position: ChessPosition,
	move: ChessMove,
	kind: BoardTransitionKind,
): BoardTransition {
	const plans = planStages(position, move);

	return {
		kind,
		stages: ('backward' === kind ? reversePlans(plans) : plans).map((plan) => {
			lastTick += 1;

			return { ...plan, tick: lastTick };
		}),
	};
}

/** What the move sends travelling, going forward, beat by beat. */
function planStages(position: ChessPosition, move: ChessMove): StagePlan[] {
	if (move.isEnPassant) {
		return planEnPassant(position, move);
	}

	if (undefined !== move.castling) {
		return planCastling(position, move, move.castling);
	}

	if (undefined !== move.promotion) {
		return planPromotion(position, move);
	}

	return [played(position, move)];
}

/** The beat the move lands on: everything is where the state says, and it is heard. */
function played(position: ChessPosition, move: ChessMove): StagePlan {
	return {
		slides: [{ from: move.from, to: move.to, taken: ChessBoard.pieceAt(position, move.to) }],
		board: undefined,
		sound: landing(position, move),
	};
}

/**
 * A promotion is two things at once and only the pawn travels: the piece it becomes takes
 * its place on a beat that moves nothing, rather than sailing in from nowhere.
 */
function planPromotion(position: ChessPosition, move: ChessMove): StagePlan[] {
	const travel: BoardSlideStep = {
		from: move.from,
		to: move.to,
		taken: ChessBoard.pieceAt(position, move.to),
	};

	return [
		{ slides: [travel], board: slid(position, travel), sound: landing(position, move) },
		{ slides: [], board: undefined, sound: undefined },
	];
}

/**
 * Castling travels two pieces, so each gets a beat of its own or the move would be heard
 * once: the rook goes round first, the king follows and lands it.
 */
function planCastling(position: ChessPosition, move: ChessMove, side: CastlingSide): StagePlan[] {
	const rook = rookSlide(move, side);

	return [{ slides: [rook], board: slid(position, rook), sound: 'move' }, played(position, move)];
}

/**
 * A pawn taken en passant is captured on a square it does not stand on, which no slide can
 * say. Walking it back there first leaves an ordinary capture on the beat after.
 */
function planEnPassant(position: ChessPosition, move: ChessMove): StagePlan[] {
	const pawn = ChessSquare.fromIndex(capturedPawn(move));
	const retreat: BoardSlideStep = { from: pawn, to: move.to, taken: undefined };
	const capture: BoardSlideStep = {
		from: move.from,
		to: move.to,
		taken: ChessBoard.pieceAt(position, pawn),
	};

	return [
		{ slides: [retreat], board: slid(position, retreat), sound: 'move' },
		{ ...played(position, move), slides: [capture] },
	];
}

/**
 * The same beats run the other way. The boards do not reverse with the stages: a rewind
 * passes through the very same intermediate position.
 */
function reversePlans(plans: readonly StagePlan[]): StagePlan[] {
	const boards = plans.slice(0, -1).map((plan) => plan.board);

	return plans
		.map((plan) => ({
			...plan,
			slides: plan.slides.map(({ from, to }) => ({ from: to, to: from, taken: undefined })),
		}))
		.reverse()
		.map((plan, index) => ({ ...plan, board: boards.at(-1 - index) }));
}

/** The rook's half of a castling move, derived from the square the king reached. */
function rookSlide(move: ChessMove, side: CastlingSide): BoardSlideStep {
	const rook = ChessCastling.rookMove(ChessSquare.toIndex(move.to), side);

	return {
		from: ChessSquare.fromIndex(rook.from),
		to: ChessSquare.fromIndex(rook.to),
		taken: undefined,
	};
}

/** Where the pawn an en passant capture takes really stands: beside the capturer. */
function capturedPawn(move: ChessMove): number {
	return ChessSquare.toIndex(move.to) - ChessSquare.pawnDirection(move.color) * BOARD_SIZE;
}

/** Where a non-final beat lands: its piece has arrived, everything else is untouched. */
function slid(position: ChessPosition, { from, to }: BoardSlideStep): ChessPosition {
	const board = [...position.board];

	board[ChessSquare.toIndex(to)] = board[ChessSquare.toIndex(from)];
	board[ChessSquare.toIndex(from)] = undefined;

	return { ...position, board };
}

/**
 * What the move sounds like, judged from the position it produces. Mate outranks check,
 * which outranks a capture; a plain move is what is left.
 */
function landing(position: ChessPosition, move: ChessMove): MoveSound {
	const landed = ChessBoard.apply(position, move);

	if ('checkmate' === ChessMoveGenerator.status(landed, [])) {
		return 'checkmate';
	}

	if (ChessMoveGenerator.isInCheck(landed, landed.turn)) {
		return 'check';
	}

	return undefined === move.captured ? 'move' : 'capture';
}
