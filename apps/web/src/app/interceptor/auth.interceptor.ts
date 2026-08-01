import { HttpInterceptorFn, HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, from, of, switchMap, throwError } from 'rxjs';

import { API_BASE_URL } from '@app/definition/api.constant';
import { SessionStore } from '@app/store/session.store';
import { HttpError } from '@app/util/http-error';

const AUTH_URL = `${API_BASE_URL}/auth`;

/**
 * The endpoints that *are* the session. A 401 from any of them is the answer, not a
 * symptom: `login` means the credentials are wrong — `SessionStore` turns that into a
 * readable message — and `refresh-session` means the refresh cookie is gone too, so
 * asking it again is only how a loop would start. Leaving them out is also what keeps
 * the renewal from waiting on itself.
 */
const SESSION_URLS = [
	`${AUTH_URL}/login`,
	`${AUTH_URL}/logout`,
	`${AUTH_URL}/register`,
	`${AUTH_URL}/refresh-session`,
];

/**
 * The access cookie expires long before the refresh one, so a session that is still valid
 * starts answering 401 partway through. Renewing it and repeating the request is what keeps
 * that from surfacing as a random failure in the middle of a training: the refresh cookie is
 * scoped to `/auth/refresh-session`, so no other endpoint can renew itself.
 *
 * Doing it *once* is a two-sided problem. Requests that fail together share one renewal,
 * which `SessionStore.refresh()` owns; requests that start after it, while the cookie is
 * known to be expired, wait for the new one instead of spending a round trip on a 401
 * nobody needs to hear again.
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

					// The caller asked about its own request: answering with the error of a
					// renewal it never made would bury the 401 it has to handle.
					return throwError(() => error);
				}),
			);
		}),
	);
};

/**
 * Held back until the renewal in flight settles. A renewal that fails is not this request's
 * business: it goes out exactly as it was and answers with whatever the API says about it,
 * which is how the caller finds out rather than being told about a call it never made.
 */
function whenRenewed(sessionStore: SessionStore): Observable<unknown> {
	const renewal = sessionStore.pendingRefresh();

	if (null === renewal) {
		return of(null);
	}

	return from(renewal).pipe(catchError(() => of(null)));
}

/**
 * A 401 is only worth a renewal while there is a session to renew. Once one has been refused
 * the store knows it is over, and everything that follows is answered by the API itself
 * instead of queueing behind another pointless round trip to `refresh-session`.
 */
function isRenewable(sessionStore: SessionStore, error: unknown): boolean {
	return HttpError.hasStatus(error, HttpStatusCode.Unauthorized) && !sessionStore.isAnonymous();
}

/**
 * The renewal was refused, so the session really is over. Whoever was logged in is pulled
 * out of wherever they were; an anonymous visitor is already where they belong, and on a
 * reload it is `authenticatedGuard` that decides — moving them here would bounce every
 * visitor to the login page just for loading the app without cookies.
 */
function endSession(sessionStore: SessionStore, router: Router): void {
	if (sessionStore.isAuthenticated()) {
		void router.navigate(['/login']);
	}

	sessionStore.expire();
}
