import { Component, inject } from '@angular/core';

import { I18n } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { ApiSdkService } from '@app/service/api-sdk.service';

@Component({
	selector: 'app-save-indicator',
	templateUrl: './save-indicator.component.html',
	styleUrl: './save-indicator.component.scss',
	imports: [I18nPipe],
})
export class SaveIndicatorComponent {
	protected readonly I18n = I18n;

	private readonly apiSdk = inject(ApiSdkService);

	readonly isSaving = this.apiSdk.isSaving;
}
