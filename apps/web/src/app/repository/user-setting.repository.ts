import { Injectable, inject } from '@angular/core';
import type { UserSetting } from '@chesspecker/api-definitions';

import { ApiSdkService } from '@app/service/api-sdk.service';

@Injectable({
	providedIn: 'root',
})
export class UserSettingRepository {
	private readonly apiSdk = inject(ApiSdkService);

	async list(): Promise<readonly UserSetting[]> {
		return this.apiSdk.GET.userSetting('', { cancellable: false });
	}

	async upsert(key: string, value: unknown, updatedAt: Date): Promise<UserSetting> {
		return this.apiSdk.PUT.userSetting('/:key', {
			path: { key },
			params: { value, updatedAt: updatedAt.toISOString() },
		});
	}
}
