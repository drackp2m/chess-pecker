import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';
import { patchState, signalStore, withState } from '@ngrx/signals';

import { ConnectionPhase } from '@app/definition/session-status.type';
import { I18n, i18nRef } from '@app/i18n';
import { NotificationService } from '@app/service/notification.service';
import { ApiCancelledError } from '@app/util/api-cancelled-error';

const CONNECTING_AFTER_MS = 2000;
const WAKING_AFTER_MS = 10000;

const NO_CONNECTION_MESSAGE = i18nRef(I18n.common.NO_CONNECTION_DETAIL);

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

	private readonly notificationService = inject(NotificationService);

	private readonly pending = new Map<number, number>();
	private timers: ReturnType<typeof setTimeout>[] = [];
	private nextId = 0;

	/**
	 * Sólo el sondeo de sesión cronometra: el arranque y la revalidación que lo repite
	 * cuando la app vuelve tras un rato son los dos únicos momentos en que se está
	 * esperando a que el servidor despierte, y centralizar ahí el «va lento» evita que una
	 * llamada larga cualquiera —un trabajo de fondo, sin ir más lejos— lo afirme por su
	 * cuenta. No avisa: quien mira la sesión ya tiene su propia pantalla para decirlo.
	 */
	async track<T>(answer: Promise<T>): Promise<T> {
		const id = this.start();

		try {
			return await this.settle(answer, false);
		} finally {
			this.end(id);
		}
	}

	/**
	 * El resto de llamadas. No cronometran, pero sí dicen si el servidor está ahí: un
	 * timeout o una red caída son la única forma de enterarse fuera del sondeo, y quien
	 * la sufrió no tiene por qué estar mirando la nube.
	 */
	async check<T>(answer: Promise<T>): Promise<T> {
		return this.settle(answer, true);
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

	private async settle<T>(answer: Promise<T>, warn: boolean): Promise<T> {
		try {
			const value = await answer;

			this.setReachable(true, warn);

			return value;
		} catch (error) {
			if (!ApiCancelledError.is(error)) {
				this.setReachable(!ConnectionStore.saysUnreachable(error), warn);
			}

			throw error;
		}
	}

	private setReachable(isReachable: boolean, warn: boolean): void {
		const isLost = warn && this.isReachable() && !isReachable;

		patchState(this, { isReachable });

		if (isLost) {
			this.notificationService.notify(NO_CONNECTION_MESSAGE);
		}
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
