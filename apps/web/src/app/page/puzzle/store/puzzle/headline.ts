import { I18n } from '@app/i18n';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';

export function puzzleHeadline(store: PuzzleStore): string {
	if (store.isFreePlay()) {
		return describeFreePlay(store);
	}

	if (store.isRevealing()) {
		return I18n.puzzle.PLAYING_SOLUTION;
	}

	switch (store.outcome()) {
		case 'idle':
			return I18n.puzzle.LOAD_TO_BEGIN;
		case 'opening':
		case 'replying':
			return I18n.common.OPPONENT_MOVING;
		case 'failed':
			return I18n.puzzle.WRONG_MOVE;
		case 'solved':
			return describeSolved(store);
		case 'solving':
			return 'white' === store.playerColor()
				? I18n.common.FIND_MOVE_WHITE
				: I18n.common.FIND_MOVE_BLACK;
	}
}

/**
 * A free-play game ends like any other, though nothing is graded and the board stays
 * open: it is a sandbox, with nothing to lock down or record.
 */
function describeFreePlay(store: PuzzleStore): string {
	const status = store.freePlayStatus();

	if ('checkmate' === status) {
		// Whoever is to move is the one who has been mated.
		return 'white' === store.position().turn
			? I18n.common.CHECKMATE_BLACK_WINS
			: I18n.common.CHECKMATE_WHITE_WINS;
	}

	if ('stalemate' === status) {
		return I18n.common.STALEMATE;
	}

	if ('draw' === status) {
		return I18n.common.DRAWN_POSITION;
	}

	return I18n.common.FREE_PLAY_HEADLINE;
}

function describeSolved(store: PuzzleStore): string {
	if ('revealed' === store.closure()) {
		return I18n.puzzle.THAT_WAS_THE_LINE;
	}

	return 'failed' === store.result() ? I18n.puzzle.SOLVED_AFTER_MISS : I18n.puzzle.SOLVED;
}
