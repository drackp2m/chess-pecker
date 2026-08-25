import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { PendingSyncModalComponent } from '@app/component/pending-sync-modal/pending-sync-modal.component';
import { LocalDataRepository } from '@app/repository/local-data.repository';
import { ModalStore } from '@app/store/modal.store';
import { SessionStore } from '@app/store/session.store';
import { SyncStore } from '@app/store/sync.store';
import { DiscardLocalDataUseCase } from '@app/use-case/discard-local-data.use-case';

/**
 * Logging out, whole and in one place: ask whether anything exists only here, close against
 * the API, and leave the device as if nobody had signed in.
 */
@Injectable({
	providedIn: 'root',
})
export class LogOutUseCase {
	private readonly localDataRepository = inject(LocalDataRepository);
	private readonly modalStore = inject(ModalStore);
	private readonly sessionStore = inject(SessionStore);

	private readonly syncStore = inject(SyncStore);
	private readonly discardLocalDataUseCase = inject(DiscardLocalDataUseCase);

	/** `false` when it never closed: the user cancelled, or the API could not. */
	async execute(): Promise<boolean> {
		if (!(await this.confirmPending())) {
			return false;
		}

		if (!(await this.sessionStore.logOut())) {
			return false;
		}

		await this.forgetEverything();

		return true;
	}

	/**
	 * What never reached the server exists only here and logging out deletes it, so it is
	 * pushed first: the modal only appears if that push could not manage everything.
	 */
	private async confirmPending(): Promise<boolean> {
		await this.syncStore.flush();

		if (!(await this.hasUnsaved())) {
			return true;
		}

		const modal = await this.modalStore.open(PendingSyncModalComponent);

		return firstValueFrom(modal.instance.onClose$);
	}

	/** A refused row is as lost as a pending one, and it is the case where it hurts most. */
	private async hasUnsaved(): Promise<boolean> {
		try {
			const { pending, rejected } = await this.localDataRepository.countUnsavedSync();

			return 0 < pending + rejected;
		} catch (error) {
			console.error('Could not count what this device has not saved', error);

			return true;
		}
	}

	/** The session is already closed, so a failed wipe cannot bring the logout down. */
	private async forgetEverything(): Promise<void> {
		try {
			await this.discardLocalDataUseCase.execute();
		} catch (error) {
			console.error('Could not clear the local data on log out', error);
		}
	}
}
