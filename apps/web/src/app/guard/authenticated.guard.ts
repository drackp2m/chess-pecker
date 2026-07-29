import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';

import { SessionStore } from '@app/store/session.store';

/**
 * The session is restored in the background (see `app.config.ts`), so a guard that ran
 * on the first navigation would read `unknown` and bounce an authenticated user to the
 * login page. It waits for the status to settle instead.
 */
export const authenticatedGuard: CanActivateFn = () => {
	const sessionStore = inject(SessionStore);
	const router = inject(Router);
	const status = toObservable(sessionStore.status);

	return firstValueFrom(status.pipe(filter((current) => 'unknown' !== current))).then((current) =>
		'authenticated' === current ? true : router.createUrlTree(['/login']),
	);
};
