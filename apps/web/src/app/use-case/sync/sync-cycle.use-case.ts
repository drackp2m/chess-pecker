import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { SyncCatalogSummary, SyncEntity } from '@chesspecker/api-definitions';

import type { TranslationRef } from '@app/definition/i18n.type';
import { SyncPhase } from '@app/definition/sync-phase.type';
import { I18n, i18nRef } from '@app/i18n';
import {
	LocalDataRepository,
	PendingCount,
	sumPending,
} from '@app/repository/local-data.repository';
import { SessionStore } from '@app/store/session.store';
import { PuzzleCatalogReplicaUseCase } from '@app/use-case/puzzle-catalog-replica.use-case';
import { SyncPullUseCase } from '@app/use-case/sync/sync-pull.use-case';
import { SyncPushUseCase } from '@app/use-case/sync/sync-push.use-case';
import { SyncStatus, SyncSummaryUseCase } from '@app/use-case/sync/sync-summary.use-case';
import { ApiCancelledError } from '@app/util/api-cancelled-error';
import { SYNC_LOCK, withExclusiveLock } from '@app/util/exclusive-lock';
import { HttpError } from '@app/util/http-error';

/** Lo que la pasada va contando de sí misma mientras corre. */
export interface SyncCycleProgress {
	readonly phase: SyncPhase;
	/** Filas por subir, y su desglose por tabla. */
	readonly pending: number;
	readonly pendingByEntity: PendingCount;
	readonly uploaded: number;
	readonly rejected: number;
	readonly downloaded: number;
	/** Las tablas que el resumen dejó por detrás del servidor. */
	readonly behind: readonly SyncEntity[];
	/** El servidor corre un modelo más nuevo: se baja, pero no se sube. */
	readonly canPush: boolean;
	/**
	 * No queda nada por bajar: ni tablas por detrás, ni catálogo a medias. Es lo único que
	 * obliga al arranque a esperar, porque es lo único que cambia lo que se va a pintar.
	 */
	readonly isReplicaComplete: boolean;
	readonly catalogDone: number;
	readonly catalogTotal: number;
	readonly error: TranslationRef | null;
}

export type SyncReport = (progress: Partial<SyncCycleProgress>) => void;

/**
 * Los códigos en los que nadie llegó a ejecutar nada: una red caída, un plazo agotado o una
 * pasarela que no encontró a quién preguntar. No dicen nada del modelo, así que se reintenta
 * luego. Un 500 no está aquí a propósito: ahí el servidor sí corrió, y volverá a contestar lo
 * mismo hasta que alguien lo arregle.
 */
const UNREACHABLE_STATUS = new Set([0, 408, 502, 503, 504]);

/**
 * La pasada entera: `checking` → `pushing` → `pulling`, en ese orden y nunca al revés.
 * Subir antes que bajar es lo que hace que lo de aquí llegue arriba antes de que nada de
 * arriba pueda pisarlo, y el candado es lo que impide que dos pestañas la corran a la vez.
 *
 * Termina siempre, y su final es una fase: `ready` si pudo con todo, `offline` si algo
 * pasajero la cortó, `failed` si el servidor dijo que no.
 */
@Injectable({
	providedIn: 'root',
})
export class SyncCycleUseCase {
	private readonly session = inject(SessionStore);
	private readonly summaries = inject(SyncSummaryUseCase);
	private readonly pusher = inject(SyncPushUseCase);
	private readonly puller = inject(SyncPullUseCase);
	private readonly catalog = inject(PuzzleCatalogReplicaUseCase);
	private readonly localData = inject(LocalDataRepository);

	async execute(report: SyncReport): Promise<SyncPhase> {
		try {
			return await withExclusiveLock(SYNC_LOCK, () => this.run(report));
		} catch (error) {
			console.error('The sync pass ended in an error it did not expect', error);
			report({ error: toErrorRef(error) });

			return 'failed';
		}
	}

	/**
	 * Sólo la subida, para antes de borrar: el cierre de sesión se lleva por delante todo
	 * lo que no haya llegado arriba, así que intentarlo una última vez es lo mínimo.
	 */
	async flush(report: SyncReport): Promise<void> {
		await withExclusiveLock(SYNC_LOCK, async () => {
			report({ phase: 'pushing' });

			const pushed = await this.pusher.execute();

			report({ uploaded: pushed.confirmed, rejected: pushed.rejected, phase: 'ready' });
			await this.countPending(report);
		});
	}

	private async run(report: SyncReport): Promise<SyncPhase> {
		report({ phase: 'checking', error: null });
		await this.countPending(report);

		// `GET /sync` es de un usuario, así que sin sesión no hay resumen que contrastar.
		// El catálogo sí se replica igual: es global y no es de nadie.
		if (!this.session.isAuthenticated()) {
			report({ isReplicaComplete: await this.catalog.isSynced() });
			await this.sweepCatalog(undefined, report);
			report({ isReplicaComplete: await this.catalog.isSynced() });

			return 'ready';
		}

		let status: SyncStatus;

		try {
			status = await this.summaries.read();
		} catch (error) {
			report({ error: toErrorRef(error) });

			return toFailurePhase(error);
		}

		report({
			behind: status.behind,
			canPush: status.canPush,
			isReplicaComplete: await this.isReplicaComplete(status),
		});

		return this.transfer(status, report);
	}

	private async transfer(status: SyncStatus, report: SyncReport): Promise<SyncPhase> {
		const cut = status.canPush ? await this.push(report) : false;

		report({ phase: 'pulling' });

		const pulled = await this.puller.execute(status);

		report({ downloaded: pulled.rows, ...(pulled.interrupted ? {} : { behind: [] }) });

		// El catálogo va el último a propósito: son ~22.000 ejercicios contra las decenas
		// del árbol, y quien mira el splash prefiere tener lo suyo antes que lo de todos.
		await this.sweepCatalog(status.summary.catalog, report);

		const swept = await this.catalog.isSynced(status.summary.catalog);

		report({ isReplicaComplete: !pulled.interrupted && swept });

		return cut || pulled.interrupted ? 'offline' : 'ready';
	}

	/**
	 * Nada por bajar es nada que esperar: con esto en la mano, el arranque abre la puerta sin
	 * llegar a mirar lo que la pasada haga después, que es todo trabajo que no cambia lo que
	 * hay aquí para pintar.
	 */
	private async isReplicaComplete(status: SyncStatus): Promise<boolean> {
		return 0 === status.behind.length && (await this.catalog.isSynced(status.summary.catalog));
	}

	/** `true` si algo pasajero cortó la subida y queda trabajo para la pasada siguiente. */
	private async push(report: SyncReport): Promise<boolean> {
		report({ phase: 'pushing' });

		const pushed = await this.pusher.execute();

		report({ uploaded: pushed.confirmed, rejected: pushed.rejected });
		await this.countPending(report);

		return pushed.interrupted;
	}

	private async sweepCatalog(
		catalog: SyncCatalogSummary | undefined,
		report: SyncReport,
	): Promise<void> {
		await this.catalog.run(catalog, (catalogDone, catalogTotal) => {
			report({ catalogDone, catalogTotal });
		});
	}

	private async countPending(report: SyncReport): Promise<void> {
		const pendingByEntity = await this.localData.countPendingByEntity();

		report({ pendingByEntity, pending: sumPending(pendingByEntity) });
	}
}

/**
 * Un corte no es un rechazo. Lo que no llegó a contestar —o contestó que estaba ocupado—
 * se vuelve a intentar en la pasada siguiente, y hasta entonces la aplicación funciona con
 * lo que tiene aquí, que es exactamente para lo que existe todo esto.
 */
export function toFailurePhase(error: unknown): SyncPhase {
	if (ApiCancelledError.is(error)) {
		return 'offline';
	}

	return error instanceof HttpErrorResponse && UNREACHABLE_STATUS.has(error.status)
		? 'offline'
		: 'failed';
}

function toErrorRef(error: unknown): TranslationRef {
	return HttpError.toRef(error, i18nRef(I18n.common.SYNC_FAILED));
}
