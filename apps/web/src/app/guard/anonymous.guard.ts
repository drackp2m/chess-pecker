import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { settledSessionStatus } from '@app/guard/settled-session-status';

export const anonymousGuard: CanActivateFn = () => {
	const router = inject(Router);

	return settledSessionStatus().then((current) =>
		'authenticated' === current ? router.createUrlTree(['/']) : true,
	);
};
