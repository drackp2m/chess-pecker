import { DestroyRef, Signal, inject } from '@angular/core';
import {
	StateSignals,
	WritableStateSource,
	patchState,
	signalStoreFeature,
	type,
	withMethods,
	withProps,
} from '@ngrx/signals';

import { BoardTransition, BoardTransitionKind } from '@app/definition/board-animation.type';
import { ChessPosition } from '@app/definition/chess.type';
import {
	ANNOUNCE_DELAY,
	MoveSpeed,
	REPLAY_DELAY,
	RESUME_DELAY,
	scaleForSpeed,
} from '@app/definition/move-speed.type';
import {
	PlaybackLead,
	PlaybackProgram,
	PlaybackSeek,
	PlaybackStep,
} from '@app/definition/playback.type';
import { PuzzleMove } from '@app/definition/puzzle.type';
import { PuzzleStoreProps } from '@app/page/puzzle/store/puzzle/session';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { nextTransition } from '@app/util/chess/board-transition';
import { ScheduledAction } from '@app/util/scheduled-action';

export interface PlaybackHooks {
	readonly seek: (to: number) => void;
	readonly settled: () => void;
}

interface PuzzlePlayerInput {
	readonly positions: Signal<ChessPosition[]>;
	readonly line: Signal<PuzzleMove[]>;
	readonly cursor: Signal<number>;
}

type PlayerStore = StateSignals<PuzzleStoreProps> &
	WritableStateSource<PuzzleStoreProps> &
	PuzzlePlayerInput;

interface RunningProgram {
	readonly program: PlaybackProgram;
	readonly hooks: PlaybackHooks;
	step: number;
}

interface PlayerContext {
	readonly store: PlayerStore;
	readonly scheduled: ScheduledAction;
	readonly speed: Signal<MoveSpeed>;
	running: RunningProgram | undefined;
}

interface PlaybackBeat {
	readonly ply: number;
	readonly move: PuzzleMove;
	readonly played: ChessPosition;
	readonly kind: BoardTransitionKind;
}

const LEAD_DELAY: Record<PlaybackLead, number> = { replay: REPLAY_DELAY, resume: RESUME_DELAY };

const LEAD_KIND: Record<PlaybackLead, BoardTransitionKind> = {
	replay: 'played',
	resume: 'forward',
};

function wait(
	context: PlayerContext,
	running: RunningProgram,
	delay: number,
	action: () => void,
): void {
	context.scheduled.run(action, scaleForSpeed(delay, running.program.speed ?? context.speed()));
}

function finish(context: PlayerContext, running: RunningProgram): void {
	context.running = undefined;
	patchState(context.store, { playback: undefined, announced: undefined });
	running.hooks.settled();
}

function lastLeg(store: PlayerStore, from: number): BoardTransition | undefined {
	const to = store.cursor();

	if (to === from) {
		return store.transition();
	}

	const ply = to > from ? to - 1 : to;
	const move = store.line()[ply];
	const played = store.positions()[ply];

	if (undefined === move || undefined === played) {
		return undefined;
	}

	return nextTransition(played, move, to > from ? 'forward' : 'backward');
}

function jump(context: PlayerContext, running: RunningProgram, step: PlaybackSeek): void {
	const { store } = context;
	const from = store.cursor();

	running.hooks.seek(step.to);
	patchState(store, {
		announced: undefined,
		transition: step.animate ? lastLeg(store, from) : undefined,
	});
}

function land(context: PlayerContext, running: RunningProgram, beat: PlaybackBeat): void {
	const { store } = context;

	patchState(store, { announced: undefined });
	running.hooks.seek(beat.ply + 1);
	patchState(store, { transition: nextTransition(beat.played, beat.move, beat.kind) });
}

function walk(
	context: PlayerContext,
	running: RunningProgram,
	through: number,
	lead: PlaybackLead,
	isEntry: boolean,
): void {
	const { store } = context;
	const ply = store.cursor();

	if (ply >= through) {
		advance(context);

		return;
	}

	const move = store.line()[ply];
	const played = store.positions()[ply];

	if (undefined === move || undefined === played) {
		finish(context, running);

		return;
	}

	wait(context, running, isEntry ? LEAD_DELAY[lead] : REPLAY_DELAY, () => {
		patchState(store, { announced: move });
		wait(context, running, ANNOUNCE_DELAY, () => {
			land(context, running, { ply, move, played, kind: LEAD_KIND[lead] });
			walk(context, running, through, lead, false);
		});
	});
}

function runStep(context: PlayerContext, running: RunningProgram, step: PlaybackStep): void {
	if ('seek' === step.kind) {
		jump(context, running, step);
		advance(context);

		return;
	}

	walk(context, running, step.through, step.lead, true);
}

function advance(context: PlayerContext): void {
	const running = context.running;

	if (undefined === running) {
		return;
	}

	const step = running.program.steps[running.step];

	if (undefined === step) {
		finish(context, running);

		return;
	}

	running.step += 1;
	runStep(context, running, step);
}

function run(context: PlayerContext, program: PlaybackProgram, hooks: PlaybackHooks): void {
	context.scheduled.cancel();
	context.running = { program, hooks, step: 0 };

	patchState(context.store, { playback: program.tag, announced: undefined });
	advance(context);
}

/**
 * Abandons the programme. The clock is only put out when there was something on it to put
 * out: it is shared with the take-back a refuted move is waiting for, and a programme that
 * was never running has no business cancelling that.
 *
 * What the programme was holding the board back by is given back with it, so the board lands
 * where the log leaves it — without the beats, which is the whole of what is dropped. Held
 * back is a promise to move on, and everything that writes takes the board being where the
 * log left it for granted: a move played onto a board a ply behind is written where it was
 * never played. A closed record is the one place the offset is not a promise but the head
 * itself, walking an answer that was played out after the log was sealed, and nothing here
 * may move it.
 */
function stop(context: PlayerContext): void {
	if (undefined === context.running) {
		return;
	}

	context.scheduled.cancel();
	context.running = undefined;
	patchState(context.store, (state) => ({
		playback: undefined,
		announced: undefined,
		...('open' === state.closure ? { rewound: 0 } : {}),
	}));
}

function settle(context: PlayerContext): void {
	if (undefined !== context.running) {
		context.scheduled.flush();
	}
}

/**
 * The one clock the board plays on, which is why it is handed out rather than kept: the
 * replay, the take-back and everything a programme waits on all queue on the same timeout,
 * so starting any of them puts out whatever was pending without anyone having to ask. A
 * second timer beside it would let a rewind stay alive inside a reveal.
 */
function createClock(): ScheduledAction {
	const clock = new ScheduledAction();

	inject(DestroyRef).onDestroy(() => {
		clock.cancel();
	});

	return clock;
}

function createContext(store: PlayerStore, clock: ScheduledAction): PlayerContext {
	return {
		store,
		scheduled: clock,
		speed: inject(BoardPreferenceService).moveSpeed,
		running: undefined,
	};
}

export function withPuzzlePlayer() {
	return signalStoreFeature(
		{ state: type<PuzzleStoreProps>(), props: type<PuzzlePlayerInput>() },
		withProps(() => ({ boardClock: createClock() })),
		withMethods((store) => {
			const context = createContext(store, store.boardClock);

			return {
				run: (program: PlaybackProgram, hooks: PlaybackHooks): void => {
					run(context, program, hooks);
				},

				stop: (): void => {
					stop(context);
				},

				settle: (): void => {
					settle(context);
				},
			};
		}),
	);
}
