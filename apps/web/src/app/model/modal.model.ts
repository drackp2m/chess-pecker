import { inject } from '@angular/core';
import { Subject } from 'rxjs';

import { ModalStore } from '@app/store/modal.store';

export abstract class Modal<T = void> {
	private readonly modalStore = inject(ModalStore);
	private readonly onClose = new Subject<T>();
	readonly onClose$ = this.onClose.asObservable();

	abstract TITLE: string;
	OVERLAY_CLOSABLE = true;

	close(value: T): void {
		this.onClose.next(value);
		this.onClose.complete();
		this.modalStore.close();
	}
}
