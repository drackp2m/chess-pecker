import { Point } from '@app/component/chess-board/board-geometry';
import { BoardSlide } from '@app/component/chess-board/board-playback';
import { PieceFlight } from '@app/component/chess-piece/chess-piece.component';
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
 * Every piece a beat sends travelling rises off the board and lands on its square, unless the
 * setting says otherwise. Only the one this gesture launched knows any better: it is already
 * up, or it sets off from where the pointer let go of it.
 */
export function launchSlides(
	slides: readonly BoardSlide[],
	launch: PieceLaunch | undefined,
	transition: BoardTransition | undefined,
	isLifted: boolean,
): readonly BoardSlide[] {
	const launched = undefined !== launch && launch.transition === transition ? launch : undefined;

	return slides.map((pending) => launchSlide(pending, launched, isLifted));
}

function isLaunched(pending: BoardSlide, launch: PieceLaunch): boolean {
	return pending.from === launch.from && pending.to === launch.to;
}

function launchSlide(
	pending: BoardSlide,
	launch: PieceLaunch | undefined,
	isLifted: boolean,
): BoardSlide {
	const launched = undefined !== launch && isLaunched(pending, launch) ? launch : undefined;
	const drop = launched?.drop;

	if (undefined !== drop) {
		return droppedSlide(pending, drop, isLifted ? 'drop' : 'placed');
	}

	if (!isLifted) {
		return pending;
	}

	return undefined === launched
		? { ...pending, slide: { ...pending.slide, flight: 'flown' } }
		: { ...pending, slide: { ...pending.slide, flight: 'lifted' } };
}

/** Let go of over its own square: only the last of the way is left, and nothing to wait for. */
function droppedSlide(pending: BoardSlide, drop: Point, flight: PieceFlight): BoardSlide {
	return {
		...pending,
		taken: undefined,
		slide: { ...pending.slide, x: drop.x, y: drop.y, flight },
	};
}
