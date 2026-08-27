import { Injectable, inject } from '@angular/core';
import type { UserNotification } from '@chesspecker/api-definitions';

import { ApiSdkService } from '@app/service/api-sdk.service';

@Injectable({
	providedIn: 'root',
})
export class NotificationRepository {
	private readonly apiSdk = inject(ApiSdkService);

	/**
	 * Newest first, read ones included. The poll runs off the router's own navigations, so
	 * it opts out of the cancellation a read gets by default: a page change is not a reason
	 * to drop the answer on the floor.
	 */
	async list(): Promise<readonly UserNotification[]> {
		return this.apiSdk.GET.notification('', { cancellable: false });
	}

	async markRead(uuids: readonly string[]): Promise<void> {
		return this.apiSdk.POST.notification('/read', { params: { uuids: [...uuids] } });
	}
}
