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

	// `setGlobalPrefix` acepta las tres formas como el mismo prefijo, así que el `Path` de la
	// cookie no puede depender de cuál se haya escrito en el `.env`.
	it.each(['api', '/api', '/api/'])('normalizes the prefix written as %s', (prefix) => {
		expect(jwtCookiePath(prefix, JwtEndpoints.access)).toBe('/api');
		expect(jwtCookiePath(prefix, JwtEndpoints.refresh)).toBe('/api/auth/refresh-session');
	});

	// Sin prefijo el path de la cookie de acceso sale vacío, y `Path=` no es válido: el
	// navegador la descartaría y no habría sesión.
	it('falls back to the root when there is no prefix', () => {
		expect(jwtCookiePath('', JwtEndpoints.access)).toBe('/');
		expect(jwtCookiePath('/', JwtEndpoints.access)).toBe('/');
		expect(jwtCookiePath('', JwtEndpoints.refresh)).toBe('/auth/refresh-session');
	});
});
