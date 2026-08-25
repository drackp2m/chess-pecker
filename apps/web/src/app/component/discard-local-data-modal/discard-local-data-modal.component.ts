import { Component, inject } from '@angular/core';

import { ButtonDirective } from '@app/directive/button.directive';
import { I18n } from '@app/i18n';
import { Modal } from '@app/model/modal.model';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { I18nService } from '@app/service/i18n.service';

@Component({
	selector: 'app-discard-local-data-modal',
	templateUrl: './discard-local-data-modal.component.html',
	imports: [ButtonDirective, I18nPipe],
})
export class DiscardLocalDataModalComponent extends Modal<boolean> {
	protected readonly I18n = I18n;

	private readonly i18n = inject(I18nService);

	readonly TITLE = this.i18n.translate(I18n.common.DISCARD_LOCAL_TITLE);

	confirm(): void {
		this.close(true);
	}

	dismiss(): void {
		this.close(false);
	}
}
