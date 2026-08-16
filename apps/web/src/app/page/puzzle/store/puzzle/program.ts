import { PlaybackProgram } from '@app/definition/playback.type';

/**
 * The opponent moving: the one ply the script answers with, already written onto the end of
 * the line and held a ply behind. Opening the exercise is the same programme — the opening
 * move is the opponent's answer to nothing at all — so both come at the pace of an answer.
 */
export function replyProgram(through: number): PlaybackProgram {
	return { tag: 'reply', steps: [{ kind: 'play', through, lead: 'replay' }] };
}

/**
 * The answer played out after giving up. There is no rewind in it: the whole of the answer is
 * written and held back before the programme is handed over, so the board already stands on
 * the ply it is played from and all that is left is walking it.
 */
export function revealProgram(through: number): PlaybackProgram {
	return { tag: 'reveal', steps: [{ kind: 'play', through, lead: 'replay' }] };
}

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
