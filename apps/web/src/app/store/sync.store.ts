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
	/** La puerta de arranque. Se abre una vez y no se vuelve a cerrar. */
	isReady: boolean;
	pending: number;
	pendingByEntity: PendingCount;
	uploaded: number;
	rejected: number;
	downloaded: number;
	behind: readonly SyncEntity[];
	canPush: boolean;
	/** No queda nada por bajar: lo que hay aquí es todo lo que hay arriba. */
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
 * La puerta por la que pasa el arranque, y lo único que hay que mirar para saber si la
 * réplica está al día. El ciclo lo corre `SyncCycleUseCase`; aquí sólo vive su estado, que
 * es lo que pintan el splash y —desde S7— la pantalla de ajustes.
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

	/**
	 * El arranque: una pasada, y la puerta abierta cuando termine —o cuando se acabe el
	 * plazo, que para eso está—.
	 */
	start(): Promise<void> {
		void this.sync();

		return this.whenReady();
	}

	/**
	 * Lo que hay que esperar antes de servir datos, que es sólo una cosa: que falte algo por
	 * bajar. Subir no cambia lo que se va a pintar, así que en cuanto la pasada dice que la
	 * réplica está completa la puerta se abre y lo demás sigue de fondo. `failed` y `offline`
	 * la abren igual que `ready`, y el tope de `SyncPolicy` la abre aunque la pasada siga: si
	 * no, la aplicación se colgaría justo en el caso para el que existe todo esto.
	 */
	async whenReady(): Promise<void> {
		if (this.isReady()) {
			return;
		}

		this.gate ??= this.armGate();

		return this.gate;
	}

	/** Una pasada. La que ya esté corriendo vale por la que se pida mientras. */
	async sync(): Promise<void> {
		this.running ??= this.runCycle().finally(() => {
			this.running = null;
		});

		return this.running;
	}

	/**
	 * La subida sola, para antes de borrar. Un servidor que corre un modelo más nuevo no
	 * recibe nada, igual que en el ciclo.
	 */
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
	 * Lo que se acaba de cerrar, subido ya. Un intento sellado no vuelve a cambiar, así que
	 * hacerle esperar a la pasada siguiente sólo sirve para perderlo si el dispositivo se
	 * apaga antes. Sin sesión no hay dónde subirlo, y con una pasada corriendo ya va dentro.
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
	 * Entrar es la subida grande —todo lo entrenado sin cuenta sube de golpe—, y volver a
	 * la aplicación o recuperar la red es la ocasión de mirar si hay algo nuevo.
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

	/** Los recuentos son de quien se va. La puerta no: abierta se queda. */
	reset(): void {
		patchState(this, { ...initialState, isReady: this.isReady() });
	}

	private revisit(): void {
		if (Date.now() - this.lastRunAt < SyncPolicy.revisitAfterMs) {
			return;
		}

		void this.sync();
	}

	private async runCycle(): Promise<void> {
		this.lastRunAt = Date.now();
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
