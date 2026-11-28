import { describe, expect, it } from 'vitest';

import { APP_ROUTES } from '@app/app.routes';

describe('APP_ROUTES', () => {
	it('sends an unknown route to the root, last of all', () => {
		expect(APP_ROUTES.at(-1)).toEqual({ path: '**', redirectTo: '' });
	});
});
