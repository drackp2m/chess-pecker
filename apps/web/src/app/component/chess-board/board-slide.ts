import { Signal, computed, untracked } from '@angular/core';

import { slideOffset } from '@app/component/chess-board/board-geometry';
import { PieceSlide } from '@app/component/chess-piece/chess-piece.component';
import {
	BoardTransition,
	MoveAnimation,
	shouldAnimate,
} from '@app/definition/board-animation.type';
import { PieceColor, Square } from '@app/definition/chess.type';

/** The slide a transition earned, and the square whose piece is to run it. */
export interface BoardSlide {
	readonly to: Square;
	readonly slide: PieceSlide;
}

export interface BoardSlideInput {
	readonly transition: Signal<BoardTransition | undefined>;
	readonly animation: Signal<MoveAnimation>;
	readonly orientation: Signal<PieceColor>;
}

/**
 * What the board is to slide, settled when the move lands and never revisited.
 *
 * Only the transition is watched. The setting and the orientation are read as they
 * stood at that moment, deliberately outside the reactive graph, because a board is
 * redrawn long after a move for all sorts of reasons and none of them may bring an
 * old slide back to life. Turning the animation on would otherwise send a piece that
 * has been sitting on its square since the last move sailing in from the one it left,
 * and flipping the board would replay that move backwards.
 *
 * The key is the tick alone: it already identifies the event across the whole
 * session, and anything added to it — the drawing order of the square, say — would
 * change under a flip and be read as a slide the piece had not run yet.
 */
export function createBoardSlide(input: BoardSlideInput): Signal<BoardSlide | undefined> {
	return computed(() => {
		const transition = input.transition();

		if (undefined === transition) {
			return undefined;
		}

		return untracked(() => {
			if (!shouldAnimate(transition.kind, input.animation())) {
				return undefined;
			}

			const offset = slideOffset(transition.from, transition.to, input.orientation());

			return { to: transition.to, slide: { ...offset, key: transition.tick } };
		});
	});
}
