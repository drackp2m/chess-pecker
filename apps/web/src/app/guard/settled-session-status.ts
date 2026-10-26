import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom } from 'rxjs';

import { SessionStatus } from '@app/definition/session-status.type';
import { SessionStore } from '@app/store/session.store';

/**
 * Waits for the background session restore to settle, or a guard would read `unknown` and
 * decide on a session that is still being asked for.
 */
export function settledSessionStatus(): Promise<SessionStatus> {
	const status = toObservable(inject(SessionStore).status);

	return firstValueFrom(status.pipe(filter((current) => 'unknown' !== current)));
}
