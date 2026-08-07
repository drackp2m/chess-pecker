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
 * Board events so far, counted here rather than in any store on purpose. A slide is
 * keyed by its tick, and a piece that is handed the key of a slide it has already run
 * will not run it again — so a tick may never come round a second time. Every store
 * clears its transition when the board jumps rather than moves (a restart, a rewind,
 * a new game), and a count kept alongside it would be cleared with it: the next move
 * would then be handed tick 1 again, and a piece still standing where an earlier
 * tick 1 had landed would sit there refusing to slide.
 */
let lastTick = 0;

/**
 * Builds the transition for a board event, every stage under a tick nothing else can
 * hold. `position` is the board the move is played from, whichever way it is about to
 * be travelled: a take-back runs the very same stages the other way round.
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

	return [played(position, move)];
}

/** The beat the move lands on: everything is where the state says, and it is heard. */
function played(position: ChessPosition, move: ChessMove): StagePlan {
	return {
		slides: [{ from: move.from, to: move.to }],
		board: undefined,
		sound: landing(position, move),
	};
}

/**
 * Castling travels two pieces, and a single beat carrying both of them arrives once and
 * is heard once. The rook goes round first and the king follows, so each sets off on a
 * beat of its own — the rook merely travelling, the king landing the move.
 */
function planCastling(position: ChessPosition, move: ChessMove, side: CastlingSide): StagePlan[] {
	const rook = rookSlide(move, side);

	return [{ slides: [rook], board: slid(position, rook), sound: 'move' }, played(position, move)];
}

/**
 * A pawn taken en passant is captured on a square it does not stand on, which no
 * slide can say. Walking it back onto that square first leaves an ordinary capture,
 * so the two beats between them describe a move nothing else has to know about. The
 * retreat is just a pawn travelling; the capture is what the move came to.
 */
function planEnPassant(position: ChessPosition, move: ChessMove): StagePlan[] {
	const retreat: BoardSlideStep = { from: ChessSquare.fromIndex(capturedPawn(move)), to: move.to };

	return [
		{ slides: [retreat], board: slid(position, retreat), sound: 'move' },
		played(position, move),
	];
}

/**
 * The same beats, run the other way: the last one first, every slide travelling back
 * the way it came. The boards stay where they are rather than reversing with the
 * stages — a rewind passes through the very same intermediate position, and its final
 * beat lands on the one the state has already gone back to.
 */
function reversePlans(plans: readonly StagePlan[]): StagePlan[] {
	const boards = plans.slice(0, -1).map((plan) => plan.board);

	return plans
		.map((plan) => ({
			...plan,
			slides: plan.slides.map(({ from, to }) => ({ from: to, to: from })),
		}))
		.reverse()
		.map((plan, index) => ({ ...plan, board: boards.at(-1 - index) }));
}

/** The rook's half of a castling move, derived from the square the king reached. */
function rookSlide(move: ChessMove, side: CastlingSide): BoardSlideStep {
	const rook = ChessCastling.rookMove(ChessSquare.toIndex(move.to), side);

	return { from: ChessSquare.fromIndex(rook.from), to: ChessSquare.fromIndex(rook.to) };
}

/** Where the pawn an en passant capture takes really stands: beside the capturer. */
function capturedPawn(move: ChessMove): number {
	return ChessSquare.toIndex(move.to) - ChessSquare.pawnDirection(move.color) * BOARD_SIZE;
}

/**
 * The board a beat that is not the last one lands on: the piece it sent travelling has
 * arrived, and everything else stands exactly as the move found it.
 */
function slid(position: ChessPosition, { from, to }: BoardSlideStep): ChessPosition {
	const board = [...position.board];

	board[ChessSquare.toIndex(to)] = board[ChessSquare.toIndex(from)];
	board[ChessSquare.toIndex(from)] = undefined;

	return { ...position, board };
}

/**
 * What the move itself sounds like, judged from the position it produces — the side to
 * move there is the one that received it. Mate outranks check, which outranks a
 * capture, and a plain move is what is left.
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
