import { Injectable, Injector, computed, effect, inject } from '@angular/core';
import type { SyncEntity } from '@chesspecker/api-definitions';
import { patchState, signalStore, withState } from '@ngrx/signals';

import type { TranslationRef } from '@app/definition/i18n.type';
import { Resettable } from '@app/definition/resettable.interface';
import { TREE_SYNC_ENTITIES } from '@app/definition/sync-entity.constant';
import { SyncPhase, isSettledPhase } from '@app/definition/sync-phase.type';
import { SyncPolicy } from '@app/definition/sync-policy.constant';
import { I18n, i18nRef } from '@app/i18n';
import { NO_PENDING, PendingCount } from '@app/repository/local-data.repository';
import { SessionStore } from '@app/store/session.store';
import { SyncCycleUseCase } from '@app/use-case/sync/sync-cycle.use-case';

interface SyncStoreProps {
	phase: SyncPhase;
	/** The boot gate. It opens once and never closes again. */
	isReady: boolean;
	pending: number;
	pendingByEntity: PendingCount;
	uploaded: number;
	rejected: number;
	downloaded: number;
	behind: readonly SyncEntity[];
	canPush: boolean;
	/** Nothing left to pull: what is here is everything that is up there. */
	isReplicaComplete: boolean;
	catalogDone: number;
	catalogTotal: number;
	lastSyncedAt: Date | null;
	error: TranslationRef | null;
}

const initialState: SyncStoreProps = {
	phase: 'idle',
	isReady: false,
	pending: 0,
	pendingByEntity: NO_PENDING,
	uploaded: 0,
	rejected: 0,
	downloaded: 0,
	behind: [],
	canPush: true,
	isReplicaComplete: false,
	catalogDone: 0,
	catalogTotal: 0,
	lastSyncedAt: null,
	error: null,
};

/**
 * The gate boot passes through, and the only thing to read to know the replica is current.
 * `SyncCycleUseCase` runs the cycle; only its state lives here.
 */
@Injectable({
	providedIn: 'root',
})
export class SyncStore
	extends signalStore({ protectedState: false }, withState(initialState))
	implements Resettable
{
	readonly isSyncing = computed(() => 'idle' !== this.phase() && !isSettledPhase(this.phase()));

	readonly hasPending = computed(() => 0 < this.pending());

	readonly isTreeBehind = computed(() =>
		TREE_SYNC_ENTITIES.some((entity) => this.behind().includes(entity)),
	);

	private readonly cycle = inject(SyncCycleUseCase);
	private readonly session = inject(SessionStore);
	private readonly injector = inject(Injector);

	private running: Promise<void> | null = null;
	private pushing: Promise<void> | null = null;
	private gate: Promise<void> | null = null;
	private resolveGate: (() => void) | undefined;
	private lastRunAt = 0;
	private cutPasses = 0;
	private retryTimer: ReturnType<typeof setTimeout> | undefined;

	/** Boot: one pass, and the gate open when it ends or when the deadline runs out. */
	start(): Promise<void> {
		void this.sync();

		return this.whenReady();
	}

	/**
	 * The only thing worth waiting for is something left to pull; pushing changes nothing that
	 * is about to be painted. `failed`, `offline` and the `SyncPolicy` cap all open it too.
	 */
	async whenReady(): Promise<void> {
		if (this.isReady()) {
			return;
		}

		this.gate ??= this.armGate();

		return this.gate;
	}

	/** One pass. A pass already running stands in for any asked for meanwhile. */
	async sync(): Promise<void> {
		this.running ??= this.runCycle().finally(() => {
			this.running = null;
		});

		return this.running;
	}

	/** Push only, for just before wiping. A server on a newer model receives nothing. */
	async flush(): Promise<void> {
		if (!this.canPush()) {
			return;
		}

		try {
			await this.cycle.flush((progress) => {
				patchState(this, progress);
			});
		} catch (error) {
			console.error('Could not upload what was pending', error);
		}
	}

	/**
	 * What just closed, uploaded now: a sealed attempt never changes again, so making it wait
	 * for the next pass only risks losing it if the device goes down first.
	 */
	async push(): Promise<void> {
		if (!this.session.isAuthenticated() || null !== this.running) {
			return;
		}

		this.pushing ??= this.flush().finally(() => {
			this.pushing = null;
		});

		return this.pushing;
	}

	/**
	 * Logging in is the big push: everything trained without an account goes up at once.
	 * Coming back to the app or regaining the network is the moment to look for more.
	 */
	watch(): void {
		effect(
			() => {
				if ('authenticated' === this.session.status()) {
					void this.sync();
				}
			},
			{ injector: this.injector },
		);

		document.addEventListener('visibilitychange', () => {
			if ('visible' === document.visibilityState) {
				this.revisit();
			}
		});

		window.addEventListener('online', () => {
			this.revisit();
		});
	}

	/** The counts belong to whoever is leaving. The gate does not: it stays open. */
	reset(): void {
		this.cancelRetry();
		this.cutPasses = 0;
		patchState(this, { ...initialState, isReady: this.isReady() });
	}

	private revisit(): void {
		if (Date.now() - this.lastRunAt < this.waitBeforeNextPass()) {
			return;
		}

		void this.sync();
	}

	private scheduleRetry(phase: SyncPhase): void {
		this.cancelRetry();

		if ('offline' !== phase || 0 === this.pending()) {
			this.cutPasses = 0;

			return;
		}

		const delay = this.waitBeforeNextPass();

		this.cutPasses += 1;
		this.retryTimer = setTimeout(() => {
			void this.sync();
		}, delay);
	}

	private waitBeforeNextPass(): number {
		if (0 === this.cutPasses) {
			return SyncPolicy.revisitAfterMs;
		}

		const index = Math.min(this.cutPasses - 1, SyncPolicy.cutBackoffMs.length - 1);

		return SyncPolicy.cutBackoffMs[index] ?? SyncPolicy.revisitAfterMs;
	}

	private cancelRetry(): void {
		if (undefined !== this.retryTimer) {
			clearTimeout(this.retryTimer);
			this.retryTimer = undefined;
		}
	}

	private async runCycle(): Promise<void> {
		this.lastRunAt = Date.now();
		this.cancelRetry();
		patchState(this, { uploaded: 0, rejected: 0, downloaded: 0, error: null });

		try {
			const phase = await this.cycle.execute((progress) => {
				patchState(this, progress);

				if (this.isReplicaComplete()) {
					this.open();
				}
			});

			patchState(this, {
				phase,
				...('ready' === phase ? { lastSyncedAt: new Date() } : {}),
			});
			this.scheduleRetry(phase);
		} catch (error) {
			console.error('The sync pass broke instead of ending in a phase', error);
			patchState(this, { phase: 'failed', error: i18nRef(I18n.common.SYNC_FAILED) });
		} finally {
			this.open();
		}
	}

	private armGate(): Promise<void> {
		return new Promise<void>((resolve) => {
			this.resolveGate = resolve;

			setTimeout(() => {
				this.open();
			}, SyncPolicy.startupTimeoutMs);
		});
	}

	private open(): void {
		if (this.isReady()) {
			return;
		}

		patchState(this, { isReady: true });
		this.resolveGate?.();
	}
}
