type MessageListener = (event: MessageEvent<string>) => void;
type ErrorListener = (event: ErrorEvent) => void;

const SETTLE_TURNS = 30;

export class FakeUciWorker {
	static readonly instances: FakeUciWorker[] = [];

	readonly sent: string[] = [];

	isTerminated = false;

	private readonly messageListeners = new Set<MessageListener>();

	private readonly errorListeners = new Set<ErrorListener>();

	constructor(readonly url: string) {
		FakeUciWorker.instances.push(this);
	}

	addEventListener(type: 'message' | 'error', listener: MessageListener | ErrorListener): void {
		if ('message' === type) {
			this.messageListeners.add(listener as MessageListener);
		} else {
			this.errorListeners.add(listener as ErrorListener);
		}
	}

	removeEventListener(type: 'message' | 'error', listener: MessageListener | ErrorListener): void {
		if ('message' === type) {
			this.messageListeners.delete(listener as MessageListener);
		} else {
			this.errorListeners.delete(listener as ErrorListener);
		}
	}

	postMessage(command: string): void {
		this.sent.push(command);

		if ('uci' === command) {
			this.emit('uciok');
		} else if ('isready' === command) {
			this.emit('readyok');
		}
	}

	terminate(): void {
		this.isTerminated = true;
	}

	emit(line: string): void {
		for (const listener of [...this.messageListeners]) {
			listener({ data: line } as MessageEvent<string>);
		}
	}

	fail(message: string): void {
		for (const listener of [...this.errorListeners]) {
			listener({ message, error: new Error(message) } as ErrorEvent);
		}
	}

	count(command: string): number {
		return this.sent.filter((sent) => sent === command).length;
	}

	countStarting(prefix: string): number {
		return this.sent.filter((sent) => sent.startsWith(prefix)).length;
	}

	static latest(): FakeUciWorker {
		const worker = FakeUciWorker.instances.at(-1);

		if (undefined === worker) {
			throw new Error('No engine worker was started.');
		}

		return worker;
	}

	static reset(): void {
		FakeUciWorker.instances.length = 0;
	}
}

export async function settleEngine(): Promise<void> {
	for (let turn = 0; turn < SETTLE_TURNS; turn += 1) {
		await Promise.resolve();
	}
}
