/**
 * Each session cookie's `Path`, relative to `API_PREFIX`, which `jwtCookiePath` prepends.
 * The refresh cookie hangs off its own endpoint to keep a 15-day token out of the traffic.
 */
export enum JwtEndpoints {
	access = '',
	refresh = '/auth/refresh-session',
}
