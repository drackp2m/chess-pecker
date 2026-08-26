import { describe, expect, it } from 'vitest';

import {
	BoardSlideStep,
	BoardTransition,
	BoardTransitionKind,
} from '@app/definition/board-animation.type';
import { MoveSound } from '@app/definition/sound.type';
import { nextTransition } from '@app/util/chess/board-transition';
import { ChessBoard } from '@app/util/chess/chess-board';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessNotation } from '@app/util/chess/chess-notation';

/** Bare kings and rooks, every castling right alive and no square in the way. */
const CASTLING = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
/** Black has just pushed d7-d5 past the white pawn on e5, so exd6 is legal. */
const EN_PASSANT = '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2';
/** Rooks facing each other on the fourth rank, well away from either king. */
const CAPTURE = '4k3/8/8/8/3rR3/8/8/4K3 w - - 0 1';
/** A king shut in by its own pawns, with the back rank there for the taking. */
const MATE = '6k1/5ppp/8/8/8/8/8/R3K2R w KQ - 0 1';

function build(fen: string, uci: string, kind: BoardTransitionKind = 'played') {
	const position = ChessFen.parse(fen);
	const move = ChessNotation.parse(position, uci);

	if (undefined === move) {
		throw new Error(`${uci} is not legal in ${fen}`);
	}

	return { position, transition: nextTransition(position, move, kind) };
}

/** The squares each beat sends travelling, which is all the assertions read. */
function slidesOf(transition: BoardTransition): Pick<BoardSlideStep, 'from' | 'to'>[][] {
	return transition.stages.map((stage) => stage.slides.map(({ from, to }) => ({ from, to })));
}

/** The clip each beat is heard with, in the order they are to run. */
function soundsOf(transition: BoardTransition): (MoveSound | undefined)[] {
	return transition.stages.map((stage) => stage.sound);
}

describe('nextTransition', () => {
	it('gives an ordinary move a single beat with a single slide', () => {
		const { transition } = build(CASTLING, 'a1b1');

		expect(transition.kind).toBe('played');
		expect(slidesOf(transition)).toEqual([[{ from: 'a1', to: 'b1' }]]);
		// One beat lands on the position the state itself moved to.
		expect(transition.stages[0]?.board).toBeUndefined();
	});

	it('sends a move being taken back the other way', () => {
		expect(slidesOf(build(CASTLING, 'a1b1', 'backward').transition)).toEqual([
			[{ from: 'b1', to: 'a1' }],
		]);
	});

	/**
	 * The king is the piece the player moves to ask for a castling, so it is the piece that
	 * sets off: whether the move was clicked or dragged, the beats read the same way.
	 */
	it('castles in two beats, the king going first and the rook following it round', () => {
		expect(slidesOf(build(CASTLING, 'e1g1').transition)).toEqual([
			[{ from: 'e1', to: 'g1' }],
			[{ from: 'h1', to: 'f1' }],
		]);

		expect(slidesOf(build(CASTLING, 'e1c1').transition)).toEqual([
			[{ from: 'e1', to: 'c1' }],
			[{ from: 'a1', to: 'd1' }],
		]);
	});

	it('runs the rook over a board with the king already round it', () => {
		const { position, transition } = build(CASTLING, 'e1g1');
		const [king, rook] = transition.stages;

		if (undefined === king?.board) {
			throw new Error('the king carries no board to run over');
		}

		expect(ChessBoard.pieceAt(king.board, 'g1')).toEqual({ type: 'king', color: 'white' });
		expect(ChessBoard.pieceAt(king.board, 'e1')).toBeUndefined();
		// The rook has not set out yet, and the position the move was played from stands.
		expect(ChessBoard.pieceAt(king.board, 'h1')).toEqual({ type: 'rook', color: 'white' });
		expect(ChessBoard.pieceAt(position, 'e1')).toEqual({ type: 'king', color: 'white' });
		expect(rook?.board).toBeUndefined();
	});

	it('walks both castling pieces home again when it is taken back', () => {
		const backward = build(CASTLING, 'e1g1', 'backward').transition;

		expect(slidesOf(backward)).toEqual([[{ from: 'f1', to: 'h1' }], [{ from: 'g1', to: 'e1' }]]);
		// The rook goes home first, over the board the king's own beat landed on.
		expect(backward.stages[0]?.board).toEqual(build(CASTLING, 'e1g1').transition.stages[0]?.board);
		expect(backward.stages[1]?.board).toBeUndefined();
	});

	/**
	 * The pawn is taken on a square it does not stand on, which no slide can say.
	 * Walking it back onto that square first leaves an ordinary capture.
	 */
	it('takes en passant in two beats, the captured pawn stepping back first', () => {
		expect(slidesOf(build(EN_PASSANT, 'e5d6').transition)).toEqual([
			[{ from: 'd5', to: 'd6' }],
			[{ from: 'e5', to: 'd6' }],
		]);
	});

	it('runs the retreat over a board of its own, leaving the real one alone', () => {
		const { position, transition } = build(EN_PASSANT, 'e5d6');
		const [retreat, capture] = transition.stages;

		if (undefined === retreat?.board) {
			throw new Error('the retreat carries no board to run over');
		}

		expect(ChessBoard.pieceAt(retreat.board, 'd6')).toEqual({ type: 'pawn', color: 'black' });
		expect(ChessBoard.pieceAt(retreat.board, 'd5')).toBeUndefined();
		// The capturing pawn has not set out yet, and the position it came from stands.
		expect(ChessBoard.pieceAt(retreat.board, 'e5')).toEqual({ type: 'pawn', color: 'white' });
		expect(ChessBoard.pieceAt(position, 'd5')).toEqual({ type: 'pawn', color: 'black' });
		expect(capture?.board).toBeUndefined();
	});

	it('reverses the order of the beats and the way each one travels', () => {
		expect(slidesOf(build(EN_PASSANT, 'e5d6', 'backward').transition)).toEqual([
			[{ from: 'd6', to: 'e5' }],
			[{ from: 'd6', to: 'd5' }],
		]);
	});

	it('passes a rewind through the very same intermediate board', () => {
		const forward = build(EN_PASSANT, 'e5d6').transition;
		const backward = build(EN_PASSANT, 'e5d6', 'backward').transition;

		expect(backward.stages[0]?.board).toEqual(forward.stages[0]?.board);
		// Its last beat lands on the position the state has already gone back to.
		expect(backward.stages[1]?.board).toBeUndefined();
	});

	/** Mate outranks check, which outranks a capture; a plain move is what is left. */
	it('judges the clip of the beat that lands from the position the move produces', () => {
		expect(soundsOf(build(CASTLING, 'a1b1').transition)).toEqual(['move']);
		expect(soundsOf(build(CAPTURE, 'e4d4').transition)).toEqual(['capture']);
		// Taking the rook on a8 uncovers the rank the black king stands on.
		expect(soundsOf(build(CASTLING, 'a1a8').transition)).toEqual(['check']);
		expect(soundsOf(build(MATE, 'a1a8').transition)).toEqual(['checkmate']);
	});

	/**
	 * Both pieces are heard, each on the beat that sends it off, and the clip of the move
	 * itself belongs to the one that lands it.
	 */
	it('gives every beat of a two-piece move a clip of its own', () => {
		expect(soundsOf(build(CASTLING, 'e1g1').transition)).toEqual(['move', 'move']);
		expect(soundsOf(build(EN_PASSANT, 'e5d6').transition)).toEqual(['move', 'capture']);
	});

	it('keeps each clip with the piece it belongs to when the move is taken back', () => {
		expect(soundsOf(build(EN_PASSANT, 'e5d6', 'backward').transition)).toEqual(['capture', 'move']);
	});

	it('hands every beat a tick of its own, in the order they are to run', () => {
		const first = build(CASTLING, 'e1g1').transition;
		const second = build(EN_PASSANT, 'e5d6').transition;
		const ticks = [...first.stages, ...second.stages].map((stage) => stage.tick);

		// A tick that came round twice would be taken for a slide already run, and the
		// piece would stand there refusing to move.
		expect(new Set(ticks).size).toBe(ticks.length);
		expect(ticks).toEqual([...ticks].sort((left, right) => left - right));
	});
});
