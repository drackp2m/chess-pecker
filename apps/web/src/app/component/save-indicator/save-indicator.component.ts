import { Component, inject } from '@angular/core';

import { ApiSdkService } from '@app/service/api-sdk.service';

@Component({
	selector: 'app-save-indicator',
	templateUrl: './save-indicator.component.html',
	styleUrl: './save-indicator.component.scss',
})
export class SaveIndicatorComponent {
	private readonly apiSdk = inject(ApiSdkService);

	readonly isSaving = this.apiSdk.isSaving;
}
