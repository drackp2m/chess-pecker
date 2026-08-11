import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed } from '@angular/core';
import { patchState, signalStore, withState } from '@ngrx/signals';

import { ConnectionPhase } from '@app/definition/session-status.type';
import { ApiCancelledError } from '@app/util/api-cancelled-error';

const CONNECTING_AFTER_MS = 2000;
const WAKING_AFTER_MS = 10000;

const UNREACHABLE_STATUS = new Set([0, 408, 502, 503, 504]);

interface ConnectionStoreProps {
	waiting: Exclude<ConnectionPhase, 'unreachable'>;
	isReachable: boolean;
}

const initialState: ConnectionStoreProps = {
	waiting: 'idle',
	isReachable: true,
};

@Injectable({
	providedIn: 'root',
})
export class ConnectionStore extends signalStore(
	{ protectedState: false },
	withState(initialState),
) {
	readonly isUnreachable = computed(() => !this.isReachable());

	/**
	 * A failed call wins over the timers: once the API has answered badly there is nothing
	 * left to wait for.
	 */
	readonly phase = computed<ConnectionPhase>(() =>
		this.isReachable() ? this.waiting() : 'unreachable',
	);

	private readonly pending = new Map<number, number>();
	private timers: ReturnType<typeof setTimeout>[] = [];
	private nextId = 0;

	/**
	 * Every call goes through here, so the interface can say a request is taking long
	 * whoever started it — not only the session probe that runs once on startup.
	 */
	async track<T>(answer: Promise<T>): Promise<T> {
		const id = this.start();

		try {
			const value = await answer;

			patchState(this, { isReachable: true });

			return value;
		} catch (error) {
			if (!ApiCancelledError.is(error)) {
				patchState(this, { isReachable: !ConnectionStore.saysUnreachable(error) });
			}

			throw error;
		} finally {
			this.end(id);
		}
	}

	private static saysUnreachable(error: unknown): boolean {
		return error instanceof HttpErrorResponse && UNREACHABLE_STATUS.has(error.status);
	}

	private static phaseFor(elapsed: number): Exclude<ConnectionPhase, 'unreachable'> {
		if (WAKING_AFTER_MS <= elapsed) {
			return 'waking';
		}

		return CONNECTING_AFTER_MS <= elapsed ? 'connecting' : 'idle';
	}

	private start(): number {
		const id = this.nextId++;

		this.pending.set(id, Date.now());
		this.schedule();

		return id;
	}

	private end(id: number): void {
		this.pending.delete(id);
		this.schedule();
	}

	/**
	 * The phase follows the oldest call still out: a stream of quick requests must never
	 * add up to a "waking the server up" that no single one of them justifies. Timers
	 * rather than a ticking clock, and only for the thresholds still ahead.
	 */
	private schedule(): void {
		this.clearTimers();

		const oldest = this.oldestStart();

		if (undefined === oldest) {
			patchState(this, { waiting: 'idle' });

			return;
		}

		const elapsed = Date.now() - oldest;

		patchState(this, { waiting: ConnectionStore.phaseFor(elapsed) });

		this.timers = [CONNECTING_AFTER_MS, WAKING_AFTER_MS]
			.filter((threshold) => elapsed < threshold)
			.map((threshold) =>
				setTimeout(() => {
					this.schedule();
				}, threshold - elapsed),
			);
	}

	private oldestStart(): number | undefined {
		return [...this.pending.values()].reduce<number | undefined>(
			(oldest, start) => (undefined === oldest || start < oldest ? start : oldest),
			undefined,
		);
	}

	private clearTimers(): void {
		for (const timer of this.timers) {
			clearTimeout(timer);
		}

		this.timers = [];
	}
}
