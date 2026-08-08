import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';

import {
	DEFAULT_SOUND_ENABLED,
	MoveSound,
	SOUND_SOURCE,
	SoundDirection,
	normalizeSoundEnabled,
} from '@app/definition/sound.type';
import { Setting } from '@app/model/setting.model';
import { SettingStore } from '@app/store/setting.store';

/** Gestures that count as permission to start playing audio. */
const UNLOCK_EVENTS: readonly string[] = ['pointerdown', 'keydown'];

/** Ways the app can come back to the foreground, none of which is a gesture. */
const WAKE_EVENTS: readonly string[] = ['visibilitychange', 'pageshow', 'focus'];

/** Rate the clips are decoded at, since no output device is open when that happens. */
const DECODE_SAMPLE_RATE = 48000;

/** How long a `running` context may leave its clock still before it counts as deaf. */
const SILENCE_GRACE_MS = 500;

/** WebKit adds a fourth state the standard union does not carry. */
type ExtendedState = AudioContextState | 'interrupted';

/**
 * The board's sound effects, decoded once up front and fired through the Web Audio
 * API rather than `<audio>` elements — an `AudioBufferSourceNode` starts with no
 * decode latency and overlaps with itself, which matters when a reply lands while
 * the move before it is still ringing.
 *
 * The context is built **inside a gesture and never before**, which is the whole
 * point of this file. WebKit poisons the audio session of contexts that were open
 * but never running when the system interrupted it — a locked screen, another app
 * taking audio focus, a long idle stretch. A poisoned context reports `running`
 * after `resume()` and plays nothing, for the rest of the page's life; the poison
 * outlives a reload, because Safari reuses the process for the same origin, so a
 * context built at boot is born deaf every time until the browser itself is quit.
 * One built inside a gesture is unaffected even in an already-poisoned process.
 *
 * So nothing here touches the hardware until the first click or keypress: the clips
 * are decoded through an `OfflineAudioContext`, and the real context is opened by
 * `adopt`, synchronously, on the gesture. Moves played before that are dropped, which
 * is intended — there is no way to make them audible, and queueing them up would fire
 * a burst later.
 *
 * The reverse mistake is just as costly: a context that is *already* playing survives
 * the interruptions above, so it is never closed and rebuilt speculatively. `adopt`
 * only replaces one it can prove is deaf — `interrupted`, or `running` with a clock
 * that has stopped advancing — and only from within a gesture, the one moment a
 * replacement can be born healthy.
 *
 * Every gesture starts its own resume attempt rather than joining one already in
 * flight, because a blocked `resume()` is not guaranteed to settle — see `unlock`.
 */
@Injectable({
	providedIn: 'root',
})
export class SoundService {
	private readonly settingStore = inject(SettingStore);
	private readonly destroyRef = inject(DestroyRef);

	private readonly current = signal<boolean>(DEFAULT_SOUND_ENABLED);

	readonly isEnabled = this.current.asReadonly();

	private readonly buffers = new Map<string, AudioBuffer>();

	private context: AudioContext | undefined = undefined;
	private resuming: Promise<void> | undefined = undefined;

	/** Last reading of the context's clock, which stops advancing once it goes deaf. */
	private clock: { readonly time: number; readonly at: number } | undefined = undefined;

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
		this.watchContext();

		this.destroyRef.onDestroy(() => {
			void this.context?.close();
		});
	}

	update(isEnabled: boolean): void {
		this.current.set(isEnabled);

		const stored = this.stored(this.settingStore.settingEntities());

		this.settingStore.save(
			stored?.with({ payload: isEnabled }) ?? new Setting({ type: 'SOUND', payload: isEnabled }),
		);
	}

	/**
	 * Plays one clip. What a move sounds like is decided where its beats are planned —
	 * `nextTransition` — because a move that travels two pieces is heard twice, and only
	 * the board running those beats knows when each of them sets off.
	 */
	play(sound: MoveSound, direction: SoundDirection = 'forward'): void {
		if (!this.current()) {
			return;
		}

		const picked = this.pick(sound, direction);

		if (undefined !== picked) {
			this.playSource(picked);
		}
	}

	/**
	 * Fires one decoded clip, once it is known which one. A missing context means no
	 * gesture has happened yet, which is the one case worth dropping silently.
	 */
	private playSource(source: string): void {
		const context = this.context;
		const buffer = this.buffers.get(source);

		if (!this.current() || undefined === context || undefined === buffer) {
			return;
		}

		const state = this.state(context);

		if ('running' === state) {
			this.fire(context, buffer);

			return;
		}

		if ('closed' === state) {
			return;
		}

		void this.resume(context).then(() => {
			if ('running' === this.state(context) && this.current()) {
				this.fire(context, buffer);
			}
		});
	}

	private fire(context: AudioContext, buffer: AudioBuffer): void {
		const node = context.createBufferSource();

		node.buffer = buffer;
		node.connect(context.destination);
		node.addEventListener('ended', () => {
			node.disconnect();
		});
		node.start();
	}

	/**
	 * A gesture is the browser's own precondition for playing audio, and WebKit's for
	 * opening a context that is not deaf on arrival, so it is the only place a context
	 * is ever built. It also always starts a *fresh* resume attempt: Firefox leaves
	 * `resume()` pending — neither resolved nor rejected — for as long as autoplay is
	 * blocked, so reusing an in-flight promise would mean the very gesture that lifts
	 * the block never reaches `resume()`, and the context stays suspended for the rest
	 * of the page's life.
	 */
	private unlock(): void {
		const context = this.adopt();

		this.resuming = undefined;

		void this.resume(context);
	}

	/** Coming back to the foreground is not a gesture, so it may only resume. */
	private wake(): void {
		if (document.hidden) {
			return;
		}

		this.resuming = undefined;

		void this.resume(this.context);
	}

	/** Returns the context to play through, building one only when there is none to keep. */
	private adopt(): AudioContext | undefined {
		const context = this.context;

		if (undefined !== context && !this.isDeaf(context)) {
			return context;
		}

		void context?.close();

		this.context = this.createContext();
		this.clock = undefined;

		return this.context;
	}

	/**
	 * Whether the context can no longer reach the speakers. A poisoned one keeps
	 * reporting `running`, so the only tell is `currentTime`: on a live context it
	 * advances with the audio clock whether or not anything is playing.
	 */
	private isDeaf(context: AudioContext): boolean {
		const state = this.state(context);

		if ('closed' === state || 'interrupted' === state) {
			return true;
		}

		if ('running' !== state) {
			return false;
		}

		const previous = this.clock;
		const now = performance.now();
		const time = context.currentTime;

		this.clock = { time, at: now };

		return previous?.time === time && SILENCE_GRACE_MS < now - previous.at;
	}

	private resume(context: AudioContext | undefined): Promise<void> {
		if (undefined === context) {
			return Promise.resolve();
		}

		const state = this.state(context);

		if ('running' === state || 'closed' === state) {
			return Promise.resolve();
		}

		this.resuming ??= context
			.resume()
			.catch(() => undefined)
			.finally(() => {
				this.resuming = undefined;
			});

		return this.resuming;
	}

	private state(context: AudioContext): ExtendedState {
		return context.state;
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

		return new AudioContext();
	}

	/**
	 * Fetches and decodes every clip once; the whole set is a few kilobytes. The decode
	 * runs on an `OfflineAudioContext`, which opens no output device and so cannot be
	 * poisoned, and the buffers it produces belong to no context in particular — they
	 * outlive every replacement `adopt` makes.
	 */
	private preload(): void {
		if ('undefined' === typeof OfflineAudioContext) {
			return;
		}

		const decoder = new OfflineAudioContext(1, 1, DECODE_SAMPLE_RATE);

		// A `Set` because `capture` and `check` name the same file.
		const sources = new Set(
			Object.values(SOUND_SOURCE).flatMap((group) => Object.values(group).flat()),
		);

		for (const source of sources) {
			void fetch(source)
				.then((response) => response.arrayBuffer())
				.then((encoded) => decoder.decodeAudioData(encoded))
				.then((buffer) => {
					this.buffers.set(source, buffer);
				})
				// A clip that fails to load just stays silent; it must not break the board.
				.catch(() => undefined);
		}
	}

	private watchContext(): void {
		const controller = new AbortController();
		const options: AddEventListenerOptions = { passive: true, signal: controller.signal };

		for (const event of UNLOCK_EVENTS) {
			document.addEventListener(
				event,
				() => {
					this.unlock();
				},
				options,
			);
		}

		for (const event of WAKE_EVENTS) {
			window.addEventListener(
				event,
				() => {
					this.wake();
				},
				options,
			);
		}

		this.destroyRef.onDestroy(() => {
			controller.abort();
		});
	}

	private stored(settings: readonly Setting[]): Setting | undefined {
		return settings.find((setting) => 'SOUND' === setting.type);
	}
}
