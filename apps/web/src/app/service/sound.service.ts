import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';

import { ChessMove, ChessPosition } from '@app/definition/chess.type';
import {
	DEFAULT_SOUND_ENABLED,
	MoveSound,
	SOUND_SOURCE,
	SoundDirection,
	normalizeSoundEnabled,
} from '@app/definition/sound.type';
import { Setting } from '@app/model/setting.model';
import { SettingStore } from '@app/store/setting.store';
import { ChessMoveGenerator } from '@app/util/chess/chess-move-generator';

/** Gestures that count as permission to start playing audio. */
const UNLOCK_EVENTS: readonly string[] = ['pointerdown', 'keydown'];

/**
 * The board's sound effects, decoded once up front and fired through the Web Audio
 * API rather than `<audio>` elements — an `AudioBufferSourceNode` starts with no
 * decode latency and overlaps with itself, which matters when a reply lands while
 * the move before it is still ringing.
 *
 * The context is built suspended, because autoplay policy only lets it start inside
 * a user gesture; the first click or keypress anywhere in the app resumes it. Moves
 * played before that are dropped silently, which is the intended behaviour — there
 * is no way to make them audible, and queueing them up would fire a burst later.
 */
@Injectable({
	providedIn: 'root',
})
export class SoundService {
	private readonly settingStore = inject(SettingStore);
	private readonly destroyRef = inject(DestroyRef);

	private readonly current = signal<boolean>(DEFAULT_SOUND_ENABLED);

	readonly isEnabled = this.current.asReadonly();

	private readonly context = this.createContext();
	private readonly buffers = new Map<string, AudioBuffer>();

	/** Index of the variant played last, so the next draw never repeats it. */
	private lastVariant: number | undefined = undefined;

	constructor() {
		const waitForSetting = effect(() => {
			const settings = this.settingStore.settingEntities();

			if (this.settingStore.isLoading()) {
				return;
			}

			this.current.set(normalizeSoundEnabled(this.stored(settings)?.payload));
			waitForSetting.destroy();
		});

		this.preload();
		this.waitForGesture();
	}

	update(isEnabled: boolean): void {
		this.current.set(isEnabled);

		const stored = this.stored(this.settingStore.settingEntities());

		if (undefined === stored) {
			this.settingStore.add(new Setting({ type: 'SOUND', payload: isEnabled }));

			return;
		}

		this.settingStore.update(stored.with({ payload: isEnabled }));
	}

	/**
	 * Plays what `move` calls for. `position` is the one where the move is *on* the
	 * board — after it going forward, before it when a step back takes it off — so
	 * `position.turn` is the side that received it either way.
	 */
	playMove(position: ChessPosition, move: ChessMove, direction: SoundDirection = 'forward'): void {
		this.play(SoundService.describe(position, move), direction);
	}

	play(sound: MoveSound, direction: SoundDirection = 'forward'): void {
		if (!this.current()) {
			return;
		}

		const picked = this.pick(sound, direction);

		if (undefined !== picked) {
			this.playSource(picked);
		}
	}

	/** Mate outranks check, which outranks a capture; a plain move is what is left. */
	private static describe(position: ChessPosition, move: ChessMove): MoveSound {
		if ('checkmate' === ChessMoveGenerator.status(position)) {
			return 'checkmate';
		}

		if (ChessMoveGenerator.isInCheck(position, position.turn)) {
			return 'check';
		}

		return undefined === move.captured ? 'move' : 'capture';
	}

	/** Fires one decoded clip, once it is known which one. */
	private playSource(source: string): void {
		const context = this.context;
		const buffer = this.buffers.get(source);

		// Still suspended means the user has not interacted yet; `start` would be
		// queued and all of them would fire at once on the first gesture.
		if (!this.current() || 'running' !== context?.state || undefined === buffer) {
			return;
		}

		const node = context.createBufferSource();

		node.buffer = buffer;
		node.connect(context.destination);
		node.start();
	}

	/**
	 * Picks a source for `sound`, uniformly among every variant except the one played
	 * last. Pure chance would repeat one move in five, and a repeat reads as a stuck
	 * sound rather than as variety. The two directions share the counter, so stepping
	 * back and forward again does not land on the same clip either.
	 */
	private pick(sound: MoveSound, direction: SoundDirection): string | undefined {
		const sources = SOUND_SOURCE[direction][sound];
		const last = this.lastVariant;

		if (2 > sources.length) {
			return sources[0];
		}

		// Draws uniformly from the `length - 1` variants that are not `last`, then
		// shifts past it — rather than re-rolling, which has no bound on its runtime.
		const drawn = Math.floor(Math.random() * (sources.length - (undefined === last ? 0 : 1)));
		const index = undefined !== last && drawn >= last ? drawn + 1 : drawn;

		this.lastVariant = index;

		return sources[index];
	}

	private createContext(): AudioContext | undefined {
		if ('undefined' === typeof AudioContext) {
			return undefined;
		}

		const context = new AudioContext();

		this.destroyRef.onDestroy(() => {
			void context.close();
		});

		return context;
	}

	/** Fetches and decodes every clip once; the whole set is a few kilobytes. */
	private preload(): void {
		const context = this.context;

		if (undefined === context) {
			return;
		}

		// A `Set` because `capture` and `check` name the same file.
		const sources = new Set(
			Object.values(SOUND_SOURCE).flatMap((group) => Object.values(group).flat()),
		);

		for (const source of sources) {
			void fetch(source)
				.then((response) => response.arrayBuffer())
				.then((encoded) => context.decodeAudioData(encoded))
				.then((buffer) => {
					this.buffers.set(source, buffer);
				})
				// A clip that fails to load just stays silent; it must not break the board.
				.catch(() => undefined);
		}
	}

	private waitForGesture(): void {
		const context = this.context;

		if (undefined === context) {
			return;
		}

		const controller = new AbortController();

		const unlock = (): void => {
			void context.resume();
			controller.abort();
		};

		for (const event of UNLOCK_EVENTS) {
			document.addEventListener(event, unlock, { signal: controller.signal });
		}

		this.destroyRef.onDestroy(() => {
			controller.abort();
		});
	}

	private stored(settings: readonly Setting[]): Setting | undefined {
		return settings.find((setting) => 'SOUND' === setting.type);
	}
}
