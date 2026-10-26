import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';

import { ButtonDirective } from '@app/directive/button.directive';
import { I18n } from '@app/i18n';
import { Modal } from '@app/model/modal.model';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { I18nService } from '@app/service/i18n.service';

export type DiscardAction = 'log-in' | 'register';

@Component({
	selector: 'app-discard-local-data-modal',
	templateUrl: './discard-local-data-modal.component.html',
	imports: [ButtonDirective, I18nPipe],
})
export class DiscardLocalDataModalComponent extends Modal<boolean> {
	protected readonly I18n = I18n;

	readonly action = input<DiscardAction>('log-in');
	readonly owner = input<string | null>(null);

	readonly offersRegister = computed(() => 'log-in' === this.action() && null === this.owner());

	private readonly i18n = inject(I18nService);
	private readonly router = inject(Router);

	readonly TITLE = this.i18n.translate(I18n.common.DISCARD_LOCAL_TITLE);

	confirm(): void {
		this.close(true);
	}

	dismiss(): void {
		this.close(false);
	}

	register(): void {
		this.close(false);
		void this.router.navigateByUrl('/register');
	}
}
