import { Point } from '@app/component/chess-board/board-geometry';
import { BoardSlide } from '@app/component/chess-board/board-playback';
import { BoardTransition } from '@app/definition/board-animation.type';
import { Square } from '@app/definition/chess.type';

interface LaunchedMove {
	readonly from: Square | undefined;
	readonly to: Square;
}

export interface PieceLaunch extends LaunchedMove {
	readonly drop: Point | undefined;
	readonly transition: BoardTransition | undefined;
}

export function describeLaunch(
	move: LaunchedMove,
	drop: Point | undefined,
	before: BoardTransition | undefined,
	after: BoardTransition | undefined,
): PieceLaunch | undefined {
	return before === after ? undefined : { ...move, drop, transition: after };
}

/**
 * Every piece a beat sends travelling rises off the board and lands on its square. Only the
 * one this gesture launched knows any better: it is already up, or it is already there.
 */
export function liftSlides(
	slides: readonly BoardSlide[],
	launch: PieceLaunch | undefined,
	transition: BoardTransition | undefined,
): readonly BoardSlide[] {
	const launched = undefined !== launch && launch.transition === transition ? launch : undefined;

	return slides.map((pending) => liftSlide(pending, launched));
}

function isLaunched(pending: BoardSlide, launch: PieceLaunch): boolean {
	return pending.from === launch.from && pending.to === launch.to;
}

function liftSlide(pending: BoardSlide, launch: PieceLaunch | undefined): BoardSlide {
	if (undefined === launch || !isLaunched(pending, launch)) {
		return { ...pending, slide: { ...pending.slide, flight: 'flown' } };
	}

	return undefined === launch.drop
		? { ...pending, slide: { ...pending.slide, flight: 'lifted' } }
		: droppedSlide(pending, launch.drop);
}

/** Let go of over its own square: nothing is left to travel, and nothing to wait for. */
function droppedSlide(pending: BoardSlide, drop: Point): BoardSlide {
	return {
		...pending,
		taken: undefined,
		slide: { ...pending.slide, x: drop.x, y: drop.y, flight: 'drop' },
	};
}
