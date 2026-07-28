import { Injectable } from '@angular/core';

import { PIECE_VALUE } from '@app/definition/chess.constant';
import { ChessMove, ChessPosition } from '@app/definition/chess.type';
import { ChessAttack } from '@app/util/chess/chess-attack';
import { ChessBoard } from '@app/util/chess/chess-board';
import { ChessMoveGenerator } from '@app/util/chess/chess-move-generator';
import { ChessNotation } from '@app/util/chess/chess-notation';
import { ChessSquare } from '@app/util/chess/chess-square';
import { Generate } from '@app/util/generate';

const CHECKMATE_SCORE = 1000;
const CAPTURE_WEIGHT = 10;
const HANGING_WEIGHT = 9;
const CHECK_BONUS = 2;

/**
 * The machine opponent. It always answers in algebraic notation so the move travels
 * back through the very same entry point a human or a scripted exercise would use.
 */
@Injectable({
	providedIn: 'root',
})
export class ChessOpponentService {
	/** Picks a reply and returns it written in SAN, or `undefined` when the game is over. */
	chooseNotation(position: ChessPosition): string | undefined {
		const move = this.chooseMove(position);

		return undefined === move ? undefined : ChessNotation.describe(position, move);
	}

	private chooseMove(position: ChessPosition): ChessMove | undefined {
		const moves = ChessMoveGenerator.legalMoves(position);

		if (0 === moves.length) {
			return undefined;
		}

		const scored = moves.map((move) => ({ move, score: this.score(position, move) }));
		const best = Math.max(...scored.map(({ score }) => score));
		const candidates = scored.filter(({ score }) => best === score);
		const pick = candidates[Generate.randomNumber(0, candidates.length - 1)];

		return (pick ?? scored[0])?.move;
	}

	/**
	 * A deliberately shallow evaluation: take material, deliver mate, and avoid
	 * parking a piece where it can simply be taken back.
	 */
	private score(position: ChessPosition, move: ChessMove): number {
		const next = ChessBoard.apply(position, move);
		const isOpponentInCheck = ChessMoveGenerator.isInCheck(next, next.turn);

		if (isOpponentInCheck && 0 === ChessMoveGenerator.legalMoves(next).length) {
			return CHECKMATE_SCORE;
		}

		const gained =
			(undefined === move.captured ? 0 : PIECE_VALUE[move.captured]) +
			(undefined === move.promotion ? 0 : PIECE_VALUE[move.promotion]);
		const risked = this.riskedValue(next, move);

		return (
			gained * CAPTURE_WEIGHT - risked * HANGING_WEIGHT + (isOpponentInCheck ? CHECK_BONUS : 0)
		);
	}

	/** Value of the moved piece when it lands on a square the opponent attacks. */
	private riskedValue(next: ChessPosition, move: ChessMove): number {
		const landed = ChessSquare.toIndex(move.to);
		const opponent = 'white' === move.color ? 'black' : 'white';

		if (!ChessAttack.isSquareAttacked(next.board, landed, opponent)) {
			return 0;
		}

		return PIECE_VALUE[move.promotion ?? move.piece];
	}
}
