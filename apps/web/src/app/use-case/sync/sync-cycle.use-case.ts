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
import { RepairCycleUseCase } from '@app/use-case/repair-cycle.use-case';
import { SyncPullUseCase } from '@app/use-case/sync/sync-pull.use-case';
import { SyncPushUseCase } from '@app/use-case/sync/sync-push.use-case';
import { SyncStatus, SyncSummaryUseCase } from '@app/use-case/sync/sync-summary.use-case';
import { ApiCancelledError } from '@app/util/api-cancelled-error';
import { SYNC_LOCK, withExclusiveLock } from '@app/util/exclusive-lock';
import { HttpError } from '@app/util/http-error';

/** What the pass reports about itself while it runs. */
export interface SyncCycleProgress {
	readonly phase: SyncPhase;
	/** Rows still to upload, broken down by table. */
	readonly pending: number;
	readonly pendingByEntity: PendingCount;
	readonly uploaded: number;
	readonly rejected: number;
	readonly downloaded: number;
	/** The tables the summary left behind the server. */
	readonly behind: readonly SyncEntity[];
	/** The server runs a newer model: pull, but never push. */
	readonly canPush: boolean;
	/**
	 * Nothing left to pull, catalogue included. The only thing boot waits on, because it is
	 * the only thing that changes what will be painted.
	 */
	readonly isReplicaComplete: boolean;
	readonly catalogDone: number;
	readonly catalogTotal: number;
	readonly error: TranslationRef | null;
}

export type SyncReport = (progress: Partial<SyncCycleProgress>) => void;

/**
 * The codes where nothing ever ran: no network, a timeout, a gateway with nobody to ask. A
 * 500 is deliberately not here — the server did run, and will answer the same until fixed.
 */
const UNREACHABLE_STATUS = new Set([0, 408, 502, 503, 504]);

/**
 * The whole pass: `checking` → `pushing` → `pulling`, never the other way round. Pushing
 * first is what gets local rows up before anything from above can overwrite them.
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
	private readonly repair = inject(RepairCycleUseCase);
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
	 * Push only, for just before wiping: logging out destroys anything that never made it up,
	 * so one last attempt is the least it deserves.
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
		await this.heal();
		await this.countPending(report);

		// `GET /sync` belongs to a user, so there is no summary without a session; the catalogue
		// replicates anyway, being global.
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
		let cut = status.canPush ? await this.push(report) : false;

		report({ phase: 'pulling' });

		const pulled = await this.puller.execute(status);

		report({ downloaded: pulled.rows, ...(pulled.interrupted ? {} : { behind: [] }) });

		if ((await this.heal()) && status.canPush) {
			cut = (await this.push(report)) || cut;
		}

		// The catalogue goes last on purpose: ~22,000 exercises against the tree's dozens, and
		// whoever watches the splash would rather have their own first.
		await this.sweepCatalog(status.summary.catalog, report);

		const swept = await this.catalog.isSynced(status.summary.catalog);

		report({ isReplicaComplete: !pulled.interrupted && swept });

		return cut || pulled.interrupted ? 'offline' : 'ready';
	}

	/**
	 * Nothing to pull is nothing to wait for: boot opens the door on this alone, since the
	 * rest of the pass changes nothing that is about to be painted.
	 */
	private async isReplicaComplete(status: SyncStatus): Promise<boolean> {
		return 0 === status.behind.length && (await this.catalog.isSynced(status.summary.catalog));
	}

	private async heal(): Promise<boolean> {
		try {
			return 0 < (await this.repair.repairAll()).length;
		} catch (error) {
			console.error('Could not repair the cycles this device holds half of', error);

			return false;
		}
	}

	/** `true` when something transient cut the push short and work is left for the next pass. */
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
 * A cut is not a refusal: whatever never answered is retried next pass, and until then the
 * app runs on what it has locally, which is the whole point.
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
