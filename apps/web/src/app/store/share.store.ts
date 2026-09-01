import { Injectable, computed, effect, inject } from '@angular/core';
import type { PuzzleShare } from '@chesspecker/api-definitions';
import { patchState, signalStore, type, withState } from '@ngrx/signals';
import {
	entityConfig,
	removeAllEntities,
	setAllEntities,
	setEntity,
	withEntities,
} from '@ngrx/signals/entities';

import { Resettable } from '@app/definition/resettable.interface';
import { ShareRow } from '@app/repository/definition/share-schema.interface';
import { SyncStore } from '@app/store/sync.store';
import { ShareMirrorUseCase } from '@app/use-case/share-mirror.use-case';

interface ShareStoreProps {
	isLoading: boolean;
}

const initialState: ShareStoreProps = {
	isLoading: false,
};

const shareConfig = entityConfig({
	entity: type<ShareRow>(),
	collection: 'share',
	selectId: (share) => share.uuid,
});

/**
 * Which exercises this account has already sent to somebody, and what came of it. The rows
 * are the API's and only ever come down, so the store answers from the device's copy and
 * refreshes whenever a sync pass has been through.
 */
@Injectable({
	providedIn: 'root',
})
export class ShareStore
	extends signalStore({ protectedState: false }, withState(initialState), withEntities(shareConfig))
	implements Resettable
{
	private readonly mirror = inject(ShareMirrorUseCase);
	private readonly syncStore = inject(SyncStore);

	private readonly byPuzzle = computed(() => {
		const grouped = new Map<string, ShareRow[]>();

		for (const row of this.shareEntities()) {
			const bucket = grouped.get(row.lichessId) ?? [];

			bucket.push(row);
			grouped.set(row.lichessId, bucket);
		}

		return grouped;
	});

	/** What the device held, so a refresh never lands on top of a load that has not arrived. */
	private readonly loaded: Promise<void> = this.load();

	constructor() {
		super();

		this.watchSync();
	}

	/** Every challenge this account sent with that exercise, newest first. */
	sharesOf(lichessId: string): readonly ShareRow[] {
		return [...(this.byPuzzle().get(lichessId) ?? [])].sort(
			(one, other) => other.createdAt.getTime() - one.createdAt.getTime(),
		);
	}

	hasShared(lichessId: string): boolean {
		return undefined !== this.byPuzzle().get(lichessId);
	}

	/** What was just sent, in before the pass that would have brought it back on its own. */
	async record(share: PuzzleShare): Promise<void> {
		try {
			patchState(this, setEntity(await this.mirror.record(share), shareConfig));
		} catch (error: unknown) {
			// The challenge is up: the copy catching up late is not worth telling anybody.
			console.error('Could not store the challenge that was just sent', error);
		}
	}

	reset(): void {
		patchState(this, initialState, removeAllEntities(shareConfig));
	}

	private async load(): Promise<void> {
		patchState(this, { isLoading: true });

		try {
			patchState(this, setAllEntities([...(await this.mirror.read())], shareConfig));
		} catch (error: unknown) {
			// Silent on purpose: the button simply says nothing about having shared, which is
			// what it says on an exercise that was never shared either.
			console.error('Could not load the stored challenges', error);
		} finally {
			patchState(this, { isLoading: false });
		}
	}

	/** The pass is what brings them down; this only reads what it left on the device. */
	private watchSync(): void {
		effect(() => {
			if (null === this.syncStore.lastSyncedAt()) {
				return;
			}

			void this.refresh();
		});
	}

	private async refresh(): Promise<void> {
		await this.loaded;
		await this.load();
	}
}
