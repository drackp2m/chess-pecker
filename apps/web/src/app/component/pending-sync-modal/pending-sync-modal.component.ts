import { Component, OnInit, inject, signal } from '@angular/core';

import { ButtonDirective } from '@app/directive/button.directive';
import { I18n } from '@app/i18n';
import { Modal } from '@app/model/modal.model';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { LocalDataRepository } from '@app/repository/local-data.repository';
import { I18nService } from '@app/service/i18n.service';

@Component({
	selector: 'app-pending-sync-modal',
	templateUrl: './pending-sync-modal.component.html',
	imports: [ButtonDirective, I18nPipe],
})
export class PendingSyncModalComponent extends Modal<boolean> implements OnInit {
	protected readonly I18n = I18n;

	private readonly i18n = inject(I18nService);
	private readonly localDataRepository = inject(LocalDataRepository);

	readonly TITLE = this.i18n.translate(I18n.common.PENDING_SYNC_TITLE);

	/**
	 * Counted here rather than passed in: `ModalStore.open` only promises a `Modal<T>`, so
	 * whoever opens it has no way to hand anything over.
	 */
	readonly pending = signal(0);
	readonly rejected = signal(0);

	ngOnInit(): void {
		void this.count();
	}

	confirm(): void {
		this.close(true);
	}

	dismiss(): void {
		this.close(false);
	}

	private async count(): Promise<void> {
		try {
			const { pending, rejected } = await this.localDataRepository.countUnsavedSync();

			this.pending.set(pending);
			this.rejected.set(rejected);
		} catch (error) {
			console.error('Could not count what this device has not saved', error);
		}
	}
}
