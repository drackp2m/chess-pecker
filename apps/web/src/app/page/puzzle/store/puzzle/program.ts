import { PlaybackProgram } from '@app/definition/playback.type';

/**
 * The restart button: back to the board the exercise opened on, with the opponent's first
 * move played onto it again. The line is left standing to its full length, so everything
 * that was solved is still there to be stepped back up to.
 *
 * The log's own restart already stands the board on the opening move, which is where this
 * is going and not where it starts, so the seek is what puts the board a ply behind it.
 * Pressing the button is something the player just did, so the answer to it comes at the
 * pace of an answer and travels as one.
 */
export const RESTART_PROGRAM: PlaybackProgram = {
	tag: 'restart',
	steps: [
		{ kind: 'seek', to: 0, animate: false },
		{ kind: 'play', through: 1, lead: 'replay' },
	],
};

/**
 * A board being come back to rather than played on: the line is stood back on the board its
 * last move was played from and that move travels again, so what the exercise was left on
 * can be seen arriving. Nothing here was asked for just now, so the position is left up long
 * enough to be read first, and it travels as the replay it is.
 */
export function resumeProgram(cursor: number): PlaybackProgram {
	return {
		tag: 'resume',
		steps: [
			{ kind: 'seek', to: cursor - 1, animate: false },
			{ kind: 'play', through: cursor, lead: 'resume' },
		],
	};
}
