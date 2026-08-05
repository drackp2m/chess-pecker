/**
 * A single pending timeout that always replaces the previous one. Both the machine
 * opponent and the puzzle replay use it to play a move after a short pause without
 * each store hand-rolling its own timer bookkeeping.
 */
export class ScheduledAction {
	private timeoutId: ReturnType<typeof setTimeout> | undefined;

	private action: (() => void) | undefined;

	run(action: () => void, delay: number): void {
		this.cancel();

		this.action = action;
		this.timeoutId = setTimeout(() => {
			this.action = undefined;
			this.timeoutId = undefined;
			action();
		}, delay);
	}

	flush(): void {
		let pending = this.action;

		while (undefined !== pending) {
			this.cancel();
			pending();

			pending = this.action;
		}
	}

	cancel(): void {
		this.action = undefined;

		if (undefined !== this.timeoutId) {
			clearTimeout(this.timeoutId);
			this.timeoutId = undefined;
		}
	}
}
