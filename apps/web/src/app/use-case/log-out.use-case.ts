import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { PendingSyncModalComponent } from '@app/component/pending-sync-modal/pending-sync-modal.component';
import { Resettable } from '@app/definition/resettable.interface';
import { LocalDataRepository } from '@app/repository/local-data.repository';
import { ActivityStore } from '@app/store/activity.store';
import { ModalStore } from '@app/store/modal.store';
import { ProfileStore } from '@app/store/profile.store';
import { SessionStore } from '@app/store/session.store';
import { SyncStore } from '@app/store/sync.store';
import { TrainingStore } from '@app/store/training.store';

/**
 * Cerrar sesión, entero y en un solo sitio: preguntar si hay algo que sólo esté aquí,
 * cerrar contra el API, y dejar el dispositivo como si nadie hubiera entrado.
 */
@Injectable({
	providedIn: 'root',
})
export class LogOutUseCase {
	private readonly localDataRepository = inject(LocalDataRepository);
	private readonly modalStore = inject(ModalStore);
	private readonly sessionStore = inject(SessionStore);

	private readonly syncStore = inject(SyncStore);

	/**
	 * Todo lo que guarda algo del usuario en memoria. Un store nuevo con datos suyos se
	 * añade aquí, que es lo único que hay que recordar para que salga con los demás.
	 */
	private readonly stores: readonly Resettable[] = [
		inject(ActivityStore),
		inject(ProfileStore),
		this.syncStore,
		inject(TrainingStore),
	];

	/** `false` si no se llegó a cerrar: lo canceló el usuario, o el API no pudo. */
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
	 * Lo que no ha llegado al servidor sólo existe aquí, y el cierre lo borra. Así que
	 * primero se intenta subirlo: el modal sólo aparece si esa subida no pudo con todo, y
	 * dice cuántas quedaron. Si no se puede ni mirar, se pregunta igual antes que borrar
	 * a ciegas.
	 */
	private async confirmPending(): Promise<boolean> {
		await this.syncStore.flush();

		if (!(await this.hasPending())) {
			return true;
		}

		const modal = await this.modalStore.open(PendingSyncModalComponent);

		return firstValueFrom(modal.instance.onClose$);
	}

	private async hasPending(): Promise<boolean> {
		try {
			return 0 < (await this.localDataRepository.countPendingSync());
		} catch (error) {
			console.error('Could not count the attempts pending upload', error);

			return true;
		}
	}

	/** La sesión ya está cerrada, así que no poder borrar no puede tumbar el cierre. */
	private async forgetEverything(): Promise<void> {
		for (const store of this.stores) {
			store.reset();
		}

		try {
			await this.localDataRepository.clearUserData();
		} catch (error) {
			console.error('Could not clear the local data on log out', error);
		}
	}
}
