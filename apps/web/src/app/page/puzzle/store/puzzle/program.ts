import { PlaybackProgram } from '@app/definition/playback.type';

/**
 * The opponent moving: the scripted ply, already written and held a ply behind. Opening the
 * exercise is the same programme, so both come at the pace of an answer.
 */
export function replyProgram(through: number): PlaybackProgram {
	return { tag: 'reply', steps: [{ kind: 'play', through, lead: 'replay' }] };
}

/**
 * The answer played out after giving up. No rewind in it: the whole answer is written before
 * the programme starts, so the board already stands where it is played from.
 */
export function revealProgram(through: number): PlaybackProgram {
	return { tag: 'reveal', steps: [{ kind: 'play', through, lead: 'replay' }] };
}

/**
 * The restart button: back to the opening board with the opponent's first move played again,
 * the line left at full length. The seek is what puts the board a ply behind it.
 */
export const RESTART_PROGRAM: PlaybackProgram = {
	tag: 'restart',
	steps: [
		{ kind: 'seek', to: 0, animate: false },
		{ kind: 'play', through: 1, lead: 'replay' },
	],
};

/**
 * A board being come back to: its last move travels again so what the exercise was left on
 * is seen arriving. Nothing was asked for just now, so it is left up to be read first.
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
