import { describe, expect, it } from 'vitest';

import LOGIN_ROUTES from '@app/page/auth/login.routes';
import REGISTER_ROUTES from '@app/page/auth/register.routes';

describe('auth routes back links', () => {
	it('sends logging in and creating an account back to the profile', () => {
		expect(LOGIN_ROUTES[0]?.data.back).toBe('/profile');
		expect(REGISTER_ROUTES[0]?.data.back).toBe('/profile');
	});
});
