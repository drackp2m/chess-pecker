import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';

import { SessionStore } from '@app/store/session.store';

/**
 * Waits for the background session restore to settle, or it would read `unknown` and bounce
 * an authenticated user. `unreachable` goes home instead of to login, which would be a lie.
 */
export const authenticatedGuard: CanActivateFn = () => {
	const sessionStore = inject(SessionStore);
	const router = inject(Router);
	const status = toObservable(sessionStore.status);

	return firstValueFrom(status.pipe(filter((current) => 'unknown' !== current))).then((current) =>
		'authenticated' === current
			? true
			: router.createUrlTree(['unreachable' === current ? '/' : '/login']),
	);
};
