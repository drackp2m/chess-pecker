import { DestroyRef, Injectable, inject } from '@angular/core';
import { patchState, signalStore, withState } from '@ngrx/signals';

import { BoardPresenter } from '@app/definition/board-presenter.interface';
import {
	ChessMove,
	ChessPosition,
	PieceColor,
	PromotionPieceType,
	Square,
} from '@app/definition/chess.type';
import { MatchOpponentModel, MatchSnapshot } from '@app/definition/match.type';
import { ANNOUNCE_DELAY, THINK_DELAY, scaleForSpeed } from '@app/definition/move-speed.type';
import { I18n, i18nRef } from '@app/i18n';
import { ChessOpponentService } from '@app/page/match/service/chess-opponent.service';
import { acceptsDraw } from '@app/page/match/service/draw-offer';
import { PositionAnalysisService } from '@app/page/match/service/position-analysis.service';
import { StockfishOpponentService } from '@app/page/match/service/stockfish-opponent.service';
import type { StockfishElo } from '@app/page/match/service/stockfish-opponent.service';
import { withMatchComputed } from '@app/page/match/store/match-computed';
import {
	buildInitialState,
	lineStatus,
	playOnLine,
	positionAt,
	restoredState,
} from '@app/page/match/store/match-state';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { nextTransition } from '@app/util/chess/board-transition';
import { ChessBoard } from '@app/util/chess/chess-board';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessNotation } from '@app/util/chess/chess-notation';
import { ScheduledAction } from '@app/util/scheduled-action';

@Injectable()
export class MatchStore
	extends signalStore({ protectedState: false }, withState(buildInitialState), withMatchComputed())
	implements BoardPresenter
{
	private readonly opponent = inject(ChessOpponentService);

	private readonly stockfish = inject(StockfishOpponentService);

	private readonly analysis = inject(PositionAnalysisService, { optional: true });

	private readonly speed = inject(BoardPreferenceService).moveSpeed;

	private readonly scheduled = new ScheduledAction();

	private opponentRequest = 0;

	constructor() {
		super();

		inject(DestroyRef).onDestroy(() => {
			this.scheduled.cancel();
		});
	}

	startMatch(playerColor: PieceColor): void {
		this.reset(playerColor, this.showAnalysis());
		patchState(this, { status: 'playing' });
		this.scheduleOpponentMove();
	}

	newMatch(): void {
		this.reset(this.playerColor(), undefined);
	}

	restore(snapshot: MatchSnapshot): void {
		this.scheduled.cancel();
		this.stockfish.newGame();
		patchState(this, restoredState(snapshot));
		this.scheduleOpponentMove();
	}

	setOpponentModel(opponentModel: MatchOpponentModel): void {
		patchState(this, { opponentModel });
	}

	setStockfishElo(stockfishElo: StockfishElo): void {
		patchState(this, { stockfishElo });
	}

	setShowAnalysis(showAnalysis: boolean): void {
		patchState(this, { showAnalysis });
	}

	/** Loads an exercise position; the side to move in the FEN becomes the player. */
	loadPosition(fen: string): boolean {
		if (!ChessFen.isValid(fen)) {
			patchState(this, { notationError: i18nRef(I18n.match.FEN_UNREADABLE) });

			return false;
		}

		const position = ChessFen.parse(fen);

		this.scheduled.cancel();
		this.opponentRequest += 1;
		this.stockfish.newGame();
		patchState(this, {
			...buildInitialState(position.turn, position),
			opponentModel: this.opponentModel(),
			stockfishElo: this.stockfishElo(),
			showAnalysis: this.showAnalysis(),
			status: lineStatus([position]),
		});

		return true;
	}

	selectSquare(square: Square): void {
		if (!this.canMove() || undefined !== this.pendingPromotion()) {
			return;
		}

		const moves = this.movesFromSelection().filter((move) => square === move.to);

		if (0 < moves.length) {
			this.playTarget(square, moves);

			return;
		}

		const position = this.position();
		const isMovable = ChessBoard.pieceAt(position, square)?.color === position.turn;

		patchState(this, { selected: isMovable && square !== this.selected() ? square : undefined });
	}

	/**
	 * Plays a move written in notation — `Nf3`, `O-O`, `e7e8=Q` — which is how the machine
	 * opponent and every scripted exercise reach the board. `false` when it will not play.
	 */
	playNotation(notation: string): boolean {
		const position = this.livePosition();
		const move = ChessNotation.parse(position, notation);

		if (undefined === move) {
			patchState(this, { notationError: i18nRef(I18n.match.ILLEGAL_MOVE, { notation }) });

			return false;
		}

		this.commit(this.moves().length, move);

		return true;
	}

	completePromotion(promotion: PromotionPieceType): void {
		const pending = this.pendingPromotion();

		if (undefined === pending) {
			return;
		}

		const move = this.legalMoves().find(
			(legal) =>
				pending.from === legal.from && pending.to === legal.to && promotion === legal.promotion,
		);

		patchState(this, { pendingPromotion: undefined });

		if (undefined !== move) {
			this.playMove(move);
		}
	}

	cancelPromotion(): void {
		patchState(this, { pendingPromotion: undefined, selected: undefined });
	}

	resign(): void {
		if (!this.canResign()) {
			return;
		}

		this.scheduled.cancel();
		this.opponentRequest += 1;
		patchState(this, { status: 'resigned', isOpponentThinking: false, announced: undefined });
	}

	offerDraw(): void {
		if (!this.canOfferDraw()) {
			return;
		}

		const isAccepted = acceptsDraw(this.livePosition(), this.opponentColor(), this.moves().length);

		patchState(this, isAccepted ? { status: 'agreed' } : { drawOfferedAt: this.moves().length });
	}

	toggleExploration(): void {
		if (!this.isStarted()) {
			return;
		}

		const game = this.game();

		patchState(this, {
			exploration: this.isExploring()
				? undefined
				: {
						positions: game.positions.slice(0, game.cursor + 1),
						moves: game.moves.slice(0, game.cursor),
						cursor: game.cursor,
					},
			selected: undefined,
			pendingPromotion: undefined,
			transition: undefined,
		});
	}

	stepBackward(): void {
		this.moveCursor(this.line().cursor - 1);
	}

	stepForward(): void {
		this.moveCursor(this.line().cursor + 1);
	}

	rewind(): void {
		if (!this.canStepBackward()) {
			return;
		}

		this.patchCursor(0);
		patchState(this, { transition: undefined });
	}

	flipBoard(): void {
		patchState(this, { orientation: 'white' === this.orientation() ? 'black' : 'white' });
	}

	dismissError(): void {
		patchState(this, { notationError: undefined });
	}

	private reset(playerColor: PieceColor, showAnalysis: boolean | undefined): void {
		this.scheduled.cancel();
		this.opponentRequest += 1;
		this.stockfish.newGame();
		patchState(this, {
			...buildInitialState(playerColor),
			opponentModel: this.opponentModel(),
			stockfishElo: this.stockfishElo(),
			showAnalysis,
		});
	}

	private moveCursor(cursor: number): void {
		const line = this.line();

		if (0 > cursor || line.moves.length < cursor) {
			return;
		}

		const isForward = line.cursor < cursor;
		const played = line.positions[Math.min(cursor, line.cursor)];
		const stepped = line.moves[Math.min(cursor, line.cursor)];

		this.patchCursor(cursor);

		if (undefined !== played && undefined !== stepped) {
			patchState(this, {
				transition: nextTransition(played, stepped, isForward ? 'forward' : 'backward'),
			});
		}
	}

	private patchCursor(cursor: number): void {
		const exploration = this.exploration();

		patchState(this, {
			...(undefined === exploration ? { cursor } : { exploration: { ...exploration, cursor } }),
			selected: undefined,
			pendingPromotion: undefined,
		});
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

		this.playMove(first);
	}

	private playMove(move: ChessMove): void {
		const exploration = this.exploration();

		if (undefined === exploration) {
			this.commit(this.cursor(), move);

			return;
		}

		patchState(this, {
			exploration: playOnLine(exploration, move),
			selected: undefined,
			pendingPromotion: undefined,
			transition: nextTransition(positionAt(exploration), move, 'played'),
		});
	}

	private commit(from: number, move: ChessMove): void {
		const isFollowing = from === this.cursor();
		const isShown = isFollowing && !this.isExploring();
		const played = positionAt({ ...this.game(), cursor: from });
		const game = playOnLine({ ...this.game(), cursor: from }, move);

		patchState(this, {
			positions: game.positions,
			moves: game.moves,
			cursor: isFollowing ? game.cursor : this.cursor(),
			// The position just left behind is what makes this one a repetition, so the
			// verdict is read from the history the move produces, not the one it found.
			status: lineStatus(game.positions),
			notationError: undefined,
			...(from < this.moves().length ? { drawOfferedAt: undefined, announced: undefined } : {}),
			...(isShown
				? {
						selected: undefined,
						pendingPromotion: undefined,
						transition: nextTransition(played, move, 'played'),
					}
				: {}),
		});

		this.scheduleOpponentMove();
	}

	/** Hands the turn to the machine, which answers in notation after a short pause. */
	private scheduleOpponentMove(): void {
		this.scheduled.cancel();
		const request = ++this.opponentRequest;

		if ('playing' !== this.status() || this.livePosition().turn === this.playerColor()) {
			patchState(this, { isOpponentThinking: false });

			return;
		}

		patchState(this, { isOpponentThinking: true });
		this.scheduled.run(
			() => {
				this.awaitAnalysis(request);
			},
			scaleForSpeed(THINK_DELAY, this.speed()),
		);
	}

	private awaitAnalysis(request: number): void {
		const settled = this.analysis?.whenSettled(this.livePosition());

		if (undefined === settled) {
			this.announceOpponentMove(request);

			return;
		}

		void settled.then(() => {
			if (request === this.opponentRequest) {
				this.announceOpponentMove(request);
			}
		});
	}

	/**
	 * Reveals the machine's choice in two beats: the piece lights up on its own
	 * square, and only then does the move actually get played.
	 */
	private announceOpponentMove(request: number): void {
		const position = this.livePosition();

		if ('stockfish' !== this.opponentModel()) {
			this.finishOpponentMove(position, request, this.opponent.chooseNotation(position));

			return;
		}

		void this.chooseStockfishNotation(position)
			.then((move) => {
				this.finishOpponentMove(position, request, move);
			})
			.catch(() => {
				if (request === this.opponentRequest) {
					patchState(this, { isOpponentThinking: false });
				}
			});
	}

	private finishOpponentMove(
		position: ChessPosition,
		request: number,
		notation: string | undefined,
	): void {
		if (
			request !== this.opponentRequest ||
			position !== this.livePosition() ||
			'playing' !== this.status()
		) {
			return;
		}

		patchState(this, {
			isOpponentThinking: false,
			announced: undefined === notation ? undefined : ChessNotation.parse(position, notation),
		});

		if (undefined === notation) {
			return;
		}

		this.scheduled.run(
			() => {
				patchState(this, { announced: undefined });
				this.playNotation(notation);
			},
			scaleForSpeed(ANNOUNCE_DELAY, this.speed()),
		);
	}

	private chooseStockfishNotation(position: ChessPosition): Promise<string | undefined> {
		const game = { start: this.positions()[0] ?? position, moves: this.moves() };

		return this.stockfish.chooseNotation(game, position, this.stockfishElo());
	}
}
