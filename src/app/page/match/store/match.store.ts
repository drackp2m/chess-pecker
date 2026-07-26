import { DestroyRef, Injectable, computed, inject } from '@angular/core';
import { patchState, signalStore, withState } from '@ngrx/signals';

import { BoardPresenter } from '@app/definition/board-presenter.interface';
import { PIECE_LETTER } from '@app/definition/chess.constant';
import {
	ChessMove,
	ChessMoveRecord,
	ChessPosition,
	PieceColor,
	PromotionPieceType,
	Square,
} from '@app/definition/chess.type';
import { ChessOpponentService } from '@app/page/match/service/chess-opponent.service';
import { buildInitialState, rewindToPlayerTurn } from '@app/page/match/store/match-state';
import { ChessBoard } from '@app/util/chess/chess-board';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessMoveGenerator } from '@app/util/chess/chess-move-generator';
import { ChessNotation } from '@app/util/chess/chess-notation';

const OPPONENT_DELAY = 450;

@Injectable()
export class MatchStore
	extends signalStore({ protectedState: false }, withState(buildInitialState))
	implements BoardPresenter
{
	private readonly opponent = inject(ChessOpponentService);

	private timeoutId: ReturnType<typeof setTimeout> | undefined;

	readonly legalMoves = computed(() => ChessMoveGenerator.legalMoves(this.position()));

	readonly movesFromSelection = computed(() => {
		const selected = this.selected();

		return undefined === selected ? [] : this.legalMoves().filter((move) => selected === move.from);
	});

	readonly lastMove = computed(() => this.history().at(-1));

	readonly isPlayerTurn = computed(
		() => 'playing' === this.status() && this.position().turn === this.playerColor(),
	);

	readonly isFinished = computed(() => 'playing' !== this.status() && 'idle' !== this.status());

	readonly checkedSquare = computed(() => ChessMoveGenerator.checkedSquare(this.position()));

	readonly fen = computed(() => ChessFen.serialize(this.position()));

	// BoardPresenter contract. Free play has no refuted move to show, and the board
	// only waits while the machine thinks.
	readonly mistake = computed<ChessMove | undefined>(() => undefined);
	readonly isBusy = this.isOpponentThinking;
	readonly isLocked = this.isFinished;

	constructor() {
		super();

		inject(DestroyRef).onDestroy(() => {
			this.clearScheduledMove();
		});

		this.scheduleOpponentMove();
	}

	startMatch(playerColor: PieceColor): void {
		this.clearScheduledMove();
		patchState(this, buildInitialState(playerColor));
		this.scheduleOpponentMove();
	}

	/** Loads an exercise position; the side to move in the FEN becomes the player. */
	loadPosition(fen: string): boolean {
		if (!ChessFen.isValid(fen)) {
			patchState(this, { notationError: 'That FEN could not be read.' });

			return false;
		}

		const position = ChessFen.parse(fen);

		this.clearScheduledMove();
		patchState(this, {
			...buildInitialState(position.turn),
			position,
			status: ChessMoveGenerator.status(position),
		});

		return true;
	}

	selectSquare(square: Square): void {
		if (!this.isPlayerTurn() || undefined !== this.pendingPromotion()) {
			return;
		}

		const moves = this.movesFromSelection().filter((move) => square === move.to);

		if (0 < moves.length) {
			this.playTarget(square, moves);

			return;
		}

		const piece = ChessBoard.pieceAt(this.position(), square);
		const isOwnPiece = piece?.color === this.playerColor();

		patchState(this, { selected: isOwnPiece && square !== this.selected() ? square : undefined });
	}

	/**
	 * Plays a move written in chess notation — `Nf3`, `exd5`, `O-O`, `e7e8=Q`.
	 * This is the single entry point used by the machine opponent and by any
	 * scripted exercise, and it returns `false` when the notation is not playable.
	 */
	playNotation(notation: string): boolean {
		const position = this.position();
		const move = ChessNotation.parse(position, notation);

		if (undefined === move) {
			patchState(this, { notationError: `"${notation}" is not a legal move here.` });

			return false;
		}

		this.commit(position, move);

		return true;
	}

	completePromotion(promotion: PromotionPieceType): void {
		const pending = this.pendingPromotion();

		if (undefined === pending) {
			return;
		}

		patchState(this, { pendingPromotion: undefined });
		this.playNotation(`${pending.from}${pending.to}${PIECE_LETTER[promotion].toLowerCase()}`);
	}

	cancelPromotion(): void {
		patchState(this, { pendingPromotion: undefined, selected: undefined });
	}

	/** Steps back to the player's previous turn, undoing the machine's reply too. */
	undoLastMove(): void {
		this.clearScheduledMove();

		const rewound = rewindToPlayerTurn(
			{
				position: this.position(),
				positionHistory: this.positionHistory(),
				history: this.history(),
			},
			this.playerColor(),
		);

		patchState(this, {
			...rewound,
			selected: undefined,
			pendingPromotion: undefined,
			isOpponentThinking: false,
			status: ChessMoveGenerator.status(rewound.position),
			notationError: undefined,
		});

		// Only reachable when the machine opened the game and nothing else was played.
		this.scheduleOpponentMove();
	}

	flipBoard(): void {
		patchState(this, { orientation: 'white' === this.orientation() ? 'black' : 'white' });
	}

	dismissError(): void {
		patchState(this, { notationError: undefined });
	}

	/** A click on a legal target: ask which piece to promote to, or just play it. */
	private playTarget(square: Square, moves: readonly ChessMove[]): void {
		const [first] = moves;

		if (undefined === first) {
			return;
		}

		if (undefined !== first.promotion) {
			patchState(this, { pendingPromotion: { from: first.from, to: square } });

			return;
		}

		this.commit(this.position(), first);
	}

	private commit(position: ChessPosition, move: ChessMove): void {
		const record: ChessMoveRecord = {
			...move,
			san: ChessNotation.describe(position, move),
			fullmoveNumber: position.fullmoveNumber,
		};
		const next = ChessBoard.apply(position, move);

		patchState(this, {
			position: next,
			positionHistory: [...this.positionHistory(), position],
			history: [...this.history(), record],
			status: ChessMoveGenerator.status(next),
			selected: undefined,
			pendingPromotion: undefined,
			notationError: undefined,
		});

		this.scheduleOpponentMove();
	}

	/** Hands the turn to the machine, which answers in notation after a short pause. */
	private scheduleOpponentMove(): void {
		this.clearScheduledMove();

		if ('playing' !== this.status() || this.position().turn === this.playerColor()) {
			return;
		}

		patchState(this, { isOpponentThinking: true });

		this.timeoutId = setTimeout(() => {
			const notation = this.opponent.chooseNotation(this.position());

			patchState(this, { isOpponentThinking: false });

			if (undefined !== notation) {
				this.playNotation(notation);
			}
		}, OPPONENT_DELAY);
	}

	private clearScheduledMove(): void {
		if (undefined !== this.timeoutId) {
			clearTimeout(this.timeoutId);
			this.timeoutId = undefined;
		}
	}
}
