import { JwtEndpoints } from '../definition/jwt-endpoints.enum';

/**
 * Hangs a session cookie's `Path` off the API's global prefix, which `JwtEndpoints` used to
 * hardcode: moving `API_PREFIX` killed the session with no error anywhere.
 */
export const jwtCookiePath = (prefix: string, endpoint: JwtEndpoints): string => {
	const basePath = prefix
		.split('/')
		.filter((segment) => '' !== segment)
		.map((segment) => `/${segment}`)
		.join('');

	const path = `${basePath}${endpoint}`;

	return '' === path ? '/' : path;
};
