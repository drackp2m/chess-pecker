/**
 * How long an exercise has been on screen, which is what `puzzle_attempt.durationMs`
 * records — not the difference between two dates. A backgrounded tab would otherwise
 * inflate every measurement, so the clock only runs while the page is being looked at.
 */
// ToDo => the accumulator only lives as long as the training section's route injector.
// The schema expects `durationMs` to survive the exercise being left and picked up days
// later, which needs the running total flushed somewhere durable (the local draft attempt
// row of section 5 of the schema notes) on a cadence, not only at the final OK/KO.
export interface SolveTiming {
	readonly durationMs: number;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export class SolveTimer {
	private accumulated = 0;
	private openedAt: Date | undefined;
	private startedAt: number | undefined;

	start(): void {
		this.accumulated = 0;
		this.openedAt = new Date();
		this.startedAt = Date.now();
	}

	pause(): void {
		if (undefined === this.startedAt) {
			return;
		}

		this.accumulated += Date.now() - this.startedAt;
		this.startedAt = undefined;
	}

	resume(): void {
		this.startedAt ??= Date.now();
	}

	/**
	 * Stops the clock and reports the attempt as the API records it: how long it was on
	 * screen, when it was first opened and when it settled. The two dates are domain data
	 * and travel with the request, so the server does not stamp them with its own clock.
	 */
	stop(): SolveTiming {
		this.pause();

		return {
			durationMs: this.accumulated,
			createdAt: (this.openedAt ?? new Date()).toISOString(),
			updatedAt: new Date().toISOString(),
		};
	}
}
