import { computed, inject } from '@angular/core';
import {
	patchState,
	signalStoreFeature,
	withComputed,
	withMethods,
	withState,
} from '@ngrx/signals';

import type { TranslationRef } from '@app/definition/i18n.type';
import { SyncStore } from '@app/store/sync.store';

export interface SyncStateProps {
	isLoading: boolean;
	isSubmitting: boolean;
	error: TranslationRef | null;
}

export const NO_SYNC_STATE: SyncStateProps = {
	isLoading: false,
	isSubmitting: false,
	error: null,
};

export function withSyncState() {
	return signalStoreFeature(
		withState<SyncStateProps>(NO_SYNC_STATE),

		withComputed(() => {
			const sync = inject(SyncStore);

			return {
				isSyncing: computed(() => sync.isSyncing()),
				pending: computed(() => sync.pending()),
				lastSyncedAt: computed(() => sync.lastSyncedAt()),
			};
		}),

		withMethods((store) => {
			const sync = inject(SyncStore);

			return {
				whenReady: (): Promise<void> => sync.whenReady(),

				clearError: (): void => {
					patchState(store, { error: null });
				},
			};
		}),
	);
}
