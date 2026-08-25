import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { DiscardLocalDataModalComponent } from '@app/component/discard-local-data-modal/discard-local-data-modal.component';
import { Resettable } from '@app/definition/resettable.interface';
import { LocalDataRepository } from '@app/repository/local-data.repository';
import { ActivityStore } from '@app/store/activity.store';
import { ModalStore } from '@app/store/modal.store';
import { ProfileStore } from '@app/store/profile.store';
import { SyncStore } from '@app/store/sync.store';
import { TrainingStore } from '@app/store/training.store';
import { LocalOwnerUseCase } from '@app/use-case/local-owner.use-case';

@Injectable({
	providedIn: 'root',
})
export class DiscardLocalDataUseCase {
	private readonly localDataRepository = inject(LocalDataRepository);
	private readonly localOwnerUseCase = inject(LocalOwnerUseCase);
	private readonly modalStore = inject(ModalStore);

	/**
	 * Everything holding user data in memory. A new store with any of it is added here, which
	 * is the only thing to remember for it to leave with the rest.
	 */
	private readonly stores: readonly Resettable[] = [
		inject(ActivityStore),
		inject(ProfileStore),
		inject(SyncStore),
		inject(TrainingStore),
	];

	async confirm(): Promise<boolean> {
		if (!(await this.hasLocalWork())) {
			return true;
		}

		const modal = await this.modalStore.open(DiscardLocalDataModalComponent);

		return firstValueFrom(modal.instance.onClose$);
	}

	async execute(): Promise<void> {
		for (const store of this.stores) {
			store.reset();
		}

		await this.localDataRepository.clearUserData();
		await this.localOwnerUseCase.release();
	}

	private async hasLocalWork(): Promise<boolean> {
		try {
			const { attempt } = await this.localDataRepository.countUnsavedByEntity();

			return (
				0 < attempt.pending + attempt.rejected ||
				0 < (await this.localDataRepository.countPuzzleSets())
			);
		} catch (error) {
			console.error('Could not count what this device would lose', error);

			return true;
		}
	}
}
