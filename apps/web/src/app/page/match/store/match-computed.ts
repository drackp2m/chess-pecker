import { Signal, computed } from '@angular/core';
import { StateSignals, signalStoreFeature, type, withComputed } from '@ngrx/signals';

import { ChessMove, ChessMoveRecord, ChessPosition, PieceColor } from '@app/definition/chess.type';
import { MatchSnapshot } from '@app/definition/match.type';
import {
	MatchLine,
	MatchStoreProps,
	isAgreedEnding,
	positionAt,
	snapshotOf,
} from '@app/page/match/store/match-state';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessMoveGenerator } from '@app/util/chess/chess-move-generator';

type MatchState = StateSignals<MatchStoreProps>;

interface MatchTurn {
	readonly isStarted: Signal<boolean>;
	readonly isExploring: Signal<boolean>;
	readonly isLive: Signal<boolean>;
	readonly isPlayerTurn: Signal<boolean>;
	readonly isFinished: Signal<boolean>;
	readonly hasPlayerMoved: Signal<boolean>;
}

function lineComputed(store: MatchState) {
	const game = computed<MatchLine>(() => ({
		positions: store.positions(),
		moves: store.moves(),
		cursor: store.cursor(),
	}));
	const line = computed<MatchLine>(() => store.exploration() ?? game());

	return {
		game,
		line,
		position: computed(() => positionAt(line())),
		history: computed(() => line().moves.slice(0, line().cursor)),
		livePosition: computed(() => store.positions().at(-1) ?? ChessFen.initial()),
		canStepBackward: computed(() => 0 < line().cursor),
		canStepForward: computed(() => line().cursor < line().moves.length),
	};
}

function boardComputed(
	store: MatchState,
	position: Signal<ChessPosition>,
	history: Signal<readonly ChessMoveRecord[]>,
) {
	const legalMoves = computed(() => ChessMoveGenerator.legalMoves(position()));

	return {
		legalMoves,
		lastMove: computed(() => history().at(-1)),
		movesFromSelection: computed(() => {
			const selected = store.selected();

			return undefined === selected ? [] : legalMoves().filter((move) => selected === move.from);
		}),
		checkedSquare: computed(() => ChessMoveGenerator.checkedSquare(position())),
		fen: computed(() => ChessFen.serialize(position())),
	};
}

function turnComputed(store: MatchState, livePosition: Signal<ChessPosition>): MatchTurn {
	const isStarted = computed(() => 'idle' !== store.status());
	const isExploring = computed(() => undefined !== store.exploration());
	const isLive = computed(() => store.cursor() === store.moves().length);

	return {
		isStarted,
		isExploring,
		isLive,
		isPlayerTurn: computed(
			() =>
				'playing' === store.status() &&
				isLive() &&
				!isExploring() &&
				livePosition().turn === store.playerColor(),
		),
		isFinished: computed(() => 'playing' !== store.status() && isStarted()),
		hasPlayerMoved: computed(() =>
			store.moves().some((move) => store.playerColor() === move.color),
		),
	};
}

function moveComputed(store: MatchState, turn: MatchTurn, game: Signal<MatchLine>) {
	const canPlayHere = computed(
		() =>
			turn.isStarted() &&
			!isAgreedEnding(store.status()) &&
			(!turn.isLive() || 'playing' === store.status()) &&
			positionAt(game()).turn === store.playerColor(),
	);
	const canMove = computed(() => turn.isExploring() || canPlayHere());

	return {
		canMove,
		isLocked: computed(() => !canMove() && !(turn.isLive() && 'playing' === store.status())),
	};
}

function actionComputed(store: MatchState, turn: MatchTurn) {
	return {
		opponentColor: computed<PieceColor>(() =>
			'white' === store.playerColor() ? 'black' : 'white',
		),
		canResign: computed(() => 'playing' === store.status()),
		canOfferDraw: computed(
			() => turn.isPlayerTurn() && store.drawOfferedAt() !== store.moves().length,
		),
		isDrawDeclined: computed(
			() => 'playing' === store.status() && store.drawOfferedAt() === store.moves().length,
		),
		canStartOver: computed(() => turn.isFinished() || (turn.isStarted() && !turn.hasPlayerMoved())),
		isBoardFlipped: computed(() => store.orientation() !== store.playerColor()),
	};
}

function presenterComputed(store: MatchState, turn: MatchTurn) {
	return {
		mistake: computed<ChessMove | undefined>(() => undefined),
		announcedMove: computed(() =>
			turn.isExploring() || !turn.isLive() ? undefined : store.announced(),
		),
		isBusy: computed(() => !turn.isExploring() && store.isOpponentThinking()),
	};
}

function matchComputed(store: MatchState) {
	const line = lineComputed(store);
	const turn = turnComputed(store, line.livePosition);

	return {
		...line,
		...boardComputed(store, line.position, line.history),
		...turn,
		...moveComputed(store, turn, line.game),
		...actionComputed(store, turn),
		...presenterComputed(store, turn),
		snapshot: computed<MatchSnapshot>(() =>
			snapshotOf({
				positions: store.positions(),
				moves: store.moves(),
				playerColor: store.playerColor(),
				opponentModel: store.opponentModel(),
				stockfishElo: store.stockfishElo(),
				showAnalysis: store.showAnalysis(),
				orientation: store.orientation(),
				status: store.status(),
			}),
		),
	};
}

export function withMatchComputed() {
	return signalStoreFeature({ state: type<MatchStoreProps>() }, withComputed(matchComputed));
}
