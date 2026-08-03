import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';

import { SessionStore } from '@app/store/session.store';

/**
 * The session is restored in the background (see `app.config.ts`), so a guard that ran
 * on the first navigation would read `unknown` and bounce an authenticated user to the
 * login page. It waits for the status to settle instead.
 *
 * `unreachable` is not a settled answer, it is the absence of one, and the routes behind
 * this guard are the ones that cannot work without the API. Sending them to the login page
 * would be a lie —the server that is not answering is the same one that would have to
 * accept the password— so they go to the home page, which is where the connection
 * indicator, the retry and everything that does run locally are: the board, free play and
 * the settings. Coming back is one click on the program once the server answers, so the
 * attempted route is not worth remembering.
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
