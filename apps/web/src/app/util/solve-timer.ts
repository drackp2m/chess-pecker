/**
 * How long an exercise has been on screen, which is what `puzzle_attempt.durationMs`
 * records — not the difference between two dates. A backgrounded tab would otherwise
 * inflate every measurement, so the clock only runs while the page is being looked at.
 */
export interface SolveTiming {
	readonly durationMs: number;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface SolveSnapshot {
	readonly durationMs: number;
	readonly startedAt: Date | undefined;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

export const SOLVE_FLUSH_INTERVAL_MS = 5000;

export class SolveTimer {
	private accumulated = 0;
	private openedAt: Date | undefined;
	private startedAt: number | undefined;
	private ticker: ReturnType<typeof setInterval> | undefined;

	constructor(private readonly onTick: () => void = (): void => undefined) {}

	start(): void {
		this.accumulated = 0;
		this.openedAt = new Date();
		this.startedAt = Date.now();

		this.startTicking();
	}

	restore(durationMs: number, openedAt: Date): void {
		this.accumulated += durationMs;
		this.openedAt = openedAt;
	}

	pause(): void {
		this.stopTicking();

		if (undefined === this.startedAt) {
			return;
		}

		this.accumulated += Date.now() - this.startedAt;
		this.startedAt = undefined;
	}

	resume(): void {
		this.startedAt ??= Date.now();

		this.startTicking();
	}

	snapshot(): SolveSnapshot {
		const running = undefined === this.startedAt ? 0 : Date.now() - this.startedAt;

		return {
			durationMs: this.accumulated + running,
			startedAt: undefined === this.startedAt ? undefined : new Date(this.startedAt),
			createdAt: this.openedAt ?? new Date(),
			updatedAt: new Date(),
		};
	}

	/**
	 * Stops the clock and reports the attempt as the API records it: how long it was on
	 * screen, when it was first opened and when it settled. The two dates are domain data
	 * and travel with the request, so the server does not stamp them with its own clock.
	 */
	stop(): SolveTiming {
		this.pause();

		const { durationMs, createdAt, updatedAt } = this.snapshot();

		return {
			durationMs,
			createdAt: createdAt.toISOString(),
			updatedAt: updatedAt.toISOString(),
		};
	}

	private startTicking(): void {
		this.ticker ??= setInterval(() => {
			this.onTick();
		}, SOLVE_FLUSH_INTERVAL_MS);
	}

	private stopTicking(): void {
		if (undefined === this.ticker) {
			return;
		}

		clearInterval(this.ticker);
		this.ticker = undefined;
	}
}
