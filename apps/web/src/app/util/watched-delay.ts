import { ScheduledAction } from '@app/util/scheduled-action';

/**
 * A one-shot delay that only counts the time the page is actually being looked at, which
 * is the same time an attempt records as its duration: a backgrounded tab measures
 * nothing there, and must not measure anything here either. Waiting somewhere else is
 * not waiting.
 */
export class WatchedDelay {
	private readonly scheduled = new ScheduledAction();

	private action: (() => void) | undefined;
	private remaining: number | undefined;
	private startedAt: number | undefined;

	/** Starts the delay over, running from now. Whatever was pending is dropped. */
	start(delay: number, action: () => void): void {
		this.cancel();

		this.action = action;
		this.remaining = delay;

		this.resume();
	}

	/**
	 * Picks the delay up where it was left. A delay that has already run out, or one that
	 * was never started, has nothing to pick up and stays as it is.
	 */
	resume(): void {
		const action = this.action;

		if (undefined === action || undefined === this.remaining || undefined !== this.startedAt) {
			return;
		}

		const remaining = this.remaining;

		this.startedAt = Date.now();
		this.scheduled.run(() => {
			this.cancel();
			action();
		}, remaining);
	}

	/** Keeps what is left of the delay, and stops it running down. */
	pause(): void {
		const startedAt = this.startedAt;

		if (undefined === startedAt || undefined === this.remaining) {
			return;
		}

		this.scheduled.cancel();

		this.remaining = Math.max(0, this.remaining - (Date.now() - startedAt));
		this.startedAt = undefined;
	}

	cancel(): void {
		this.scheduled.cancel();

		this.action = undefined;
		this.remaining = undefined;
		this.startedAt = undefined;
	}
}
