import { Injectable, signal } from '@angular/core';

@Injectable({
	providedIn: 'root',
})
export class TimezoneService {
	private readonly timezone = signal(Intl.DateTimeFormat().resolvedOptions().timeZone);

	readonly selectedTimezone = this.timezone.asReadonly();
}
