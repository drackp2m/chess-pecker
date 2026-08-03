import { ComponentRef, Injectable, Type } from '@angular/core';
import { signalStore, withState } from '@ngrx/signals';
import { firstValueFrom, timer } from 'rxjs';

import { ModalOutletComponent } from '@app/component/modal-outlet/modal-outlet.component';
import { Modal } from '@app/model/modal.model';

interface ModalStoreProps {
	isOpen: boolean;
	isInTransition: boolean;
}

const initialState: ModalStoreProps = {
	isOpen: false,
	isInTransition: false,
};

const CONTAINER_INIT_TIMEOUT = 1000;

@Injectable({
	providedIn: 'root',
})
export class ModalStore extends signalStore({ protectedState: false }, withState(initialState)) {
	private modalOutletComponent: ModalOutletComponent | null = null;
	private readonly containerInitPromise = new Promise<void>((resolve) => {
		this.containerInitResolve = resolve;
	});

	initializeContainer(modalOutletComponent: ModalOutletComponent): void {
		this.modalOutletComponent = modalOutletComponent;
		this.containerInitResolve();
	}

	async open<T>(component: Type<Modal<T>>): Promise<ComponentRef<Modal<T>>> {
		const outlet = await this.waitForOutlet();

		return outlet.open(component);
	}

	close(): void {
		this.modalOutletComponent?.close();
	}

	private containerInitResolve: () => void = () => undefined;

	private async waitForOutlet(): Promise<ModalOutletComponent> {
		if (null === this.modalOutletComponent) {
			await Promise.race([
				this.containerInitPromise,
				firstValueFrom(timer(CONTAINER_INIT_TIMEOUT)),
			]);
		}

		const outlet = this.modalOutletComponent;

		if (null === outlet) {
			throw new Error(
				'Modal container has not been initialized. Please, call `ModalStore.initializeContainer()` first.',
			);
		}

		return outlet;
	}
}
