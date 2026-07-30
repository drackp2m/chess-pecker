/**
 * A single pending timeout that always replaces the previous one. Both the machine
 * opponent and the puzzle replay use it to play a move after a short pause without
 * each store hand-rolling its own timer bookkeeping.
 */
export class ScheduledAction {
	private timeoutId: ReturnType<typeof setTimeout> | undefined;

	run(action: () => void, delay: number): void {
		this.cancel();
		this.timeoutId = setTimeout(action, delay);
	}

	cancel(): void {
		if (undefined !== this.timeoutId) {
			clearTimeout(this.timeoutId);
			this.timeoutId = undefined;
		}
	}
}
