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

@Injectable({
	providedIn: 'root',
})
export class ModalStore extends signalStore({ protectedState: false }, withState(initialState)) {
	private modalOutletComponent: ModalOutletComponent | null = null;
	private containerInitPromise: Promise<void>;
	private initializeError = false;
	private readonly timeoutPromise = firstValueFrom(timer(1000)).then((): Promise<void> | void => {
		if (null === this.modalOutletComponent) {
			this.initializeError = true;

			return Promise.reject(new Error('Modal container initialization timeout'));
		}
	});

	constructor() {
		super();

		this.containerInitPromise = new Promise((resolve) => {
			this.containerInitResolve = resolve;
		});
	}

	initializeContainer(modalOutletComponent: ModalOutletComponent) {
		this.modalOutletComponent = modalOutletComponent;
		this.containerInitResolve();
	}

	async open<T>(component: Type<Modal<T>>): Promise<ComponentRef<Modal<T>>> {
		if (this.initializeError) {
			return Promise.reject(
				new Error(
					'Modal container has not been initialized. Please, call `ModalStore.initializeContainer()` first.',
				),
			);
		}

		await Promise.race([this.containerInitPromise, this.timeoutPromise]);

		if (null === this.modalOutletComponent) {
			return Promise.reject(new Error('Modal container has not been initialized'));
		}

		return this.modalOutletComponent.open(component);
	}

	close(): void {
		this.modalOutletComponent?.close();
	}

	private containerInitResolve: () => void = () => {
		console.log('damn javascript...');
	};
}
