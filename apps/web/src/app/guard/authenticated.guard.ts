import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { settledSessionStatus } from '@app/guard/settled-session-status';

/** `unreachable` goes home instead of to login, which would be a lie. */
export const authenticatedGuard: CanActivateFn = () => {
	const router = inject(Router);

	return settledSessionStatus().then((current) =>
		'authenticated' === current
			? true
			: router.createUrlTree(['unreachable' === current ? '/' : '/login']),
	);
};
