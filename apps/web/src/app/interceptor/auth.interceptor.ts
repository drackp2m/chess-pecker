import { HttpInterceptorFn, HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, from, of, switchMap, throwError } from 'rxjs';

import { API_BASE_URL } from '@app/definition/api.constant';
import { SessionStore } from '@app/store/session.store';
import { HttpError } from '@app/util/http-error';

const AUTH_URL = `${API_BASE_URL}/auth`;

/**
 * The endpoints that *are* the session: a 401 from one of them is the answer, not a symptom.
 * Leaving them out is also what keeps the renewal from waiting on itself.
 */
const SESSION_URLS = [
	`${AUTH_URL}/login`,
	`${AUTH_URL}/logout`,
	`${AUTH_URL}/register`,
	`${AUTH_URL}/refresh-session`,
];

/**
 * The access cookie expires long before the refresh one, so a valid session starts answering
 * 401 partway through; renewing and repeating keeps that out of the middle of a training.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
	if (!request.url.startsWith(API_BASE_URL)) {
		return next(request);
	}

	// The session lives in `httpOnly` cookies, so every call to the API has to carry them.
	const apiRequest = request.clone({ withCredentials: true });

	if (SESSION_URLS.includes(request.url)) {
		return next(apiRequest);
	}

	const sessionStore = inject(SessionStore);
	const router = inject(Router);

	return whenRenewed(sessionStore).pipe(
		switchMap(() => next(apiRequest)),
		catchError((error: unknown) => {
			if (!isRenewable(sessionStore, error)) {
				return throwError(() => error);
			}

			return from(sessionStore.refresh()).pipe(
				switchMap(() => next(apiRequest)),
				catchError(() => {
					endSession(sessionStore, router);

					// Answering with the error of a renewal the caller never made would bury its 401.
					return throwError(() => error);
				}),
			);
		}),
	);
};

/**
 * Held back until the renewal in flight settles. A failed renewal is not this request's
 * business: it goes out as it was and answers with whatever the API says about it.
 */
function whenRenewed(sessionStore: SessionStore): Observable<unknown> {
	const renewal = sessionStore.pendingRefresh();

	if (null === renewal) {
		return of(null);
	}

	return from(renewal).pipe(catchError(() => of(null)));
}

/**
 * A 401 is only worth a renewal while there is a session to renew: once one is refused,
 * everything after it is answered by the API instead of queueing behind another round trip.
 */
function isRenewable(sessionStore: SessionStore, error: unknown): boolean {
	return HttpError.hasStatus(error, HttpStatusCode.Unauthorized) && !sessionStore.isAnonymous();
}

/**
 * The session really is over, so whoever was logged in is pulled out. An anonymous visitor
 * is left alone: `authenticatedGuard` decides on reload, or every visitor would be bounced.
 */
function endSession(sessionStore: SessionStore, router: Router): void {
	if (sessionStore.isAuthenticated()) {
		void router.navigate(['/login']);
	}

	sessionStore.expire();
}
