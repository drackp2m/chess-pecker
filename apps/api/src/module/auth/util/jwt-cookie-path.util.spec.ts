import { JwtEndpoints } from '../definition/jwt-endpoints.enum';

import { jwtCookiePath } from './jwt-cookie-path.util';

describe('jwtCookiePath', () => {
	it('hangs both cookies off the configured prefix', () => {
		expect(jwtCookiePath('/api', JwtEndpoints.access)).toBe('/api');
		expect(jwtCookiePath('/api', JwtEndpoints.refresh)).toBe('/api/auth/refresh-session');
	});

	it('follows the prefix when it changes', () => {
		expect(jwtCookiePath('/v2', JwtEndpoints.access)).toBe('/v2');
		expect(jwtCookiePath('/v2', JwtEndpoints.refresh)).toBe('/v2/auth/refresh-session');
	});

	// `setGlobalPrefix` takes all three forms as the same prefix, so the cookie's `Path`
	// cannot depend on which one was written in the `.env`.
	it.each(['api', '/api', '/api/'])('normalizes the prefix written as %s', (prefix) => {
		expect(jwtCookiePath(prefix, JwtEndpoints.access)).toBe('/api');
		expect(jwtCookiePath(prefix, JwtEndpoints.refresh)).toBe('/api/auth/refresh-session');
	});

	// With no prefix the access cookie's path comes out empty, and `Path=` is invalid: the
	// browser would discard it and there would be no session.
	it('falls back to the root when there is no prefix', () => {
		expect(jwtCookiePath('', JwtEndpoints.access)).toBe('/');
		expect(jwtCookiePath('/', JwtEndpoints.access)).toBe('/');
		expect(jwtCookiePath('', JwtEndpoints.refresh)).toBe('/auth/refresh-session');
	});
});
