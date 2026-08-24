import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';

import { IntroStore } from '@app/store/intro.store';

export const introGuard: CanActivateFn = () => {
	const introStore = inject(IntroStore);
	const router = inject(Router);
	const restored = toObservable(introStore.isRestored);

	return firstValueFrom(restored.pipe(filter(Boolean))).then(
		() => introStore.isCompleted() || router.createUrlTree(['/intro']),
	);
};
