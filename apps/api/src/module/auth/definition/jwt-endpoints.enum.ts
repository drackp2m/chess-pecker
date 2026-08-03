/**
 * El `Path` de cada cookie de sesión, **relativo al prefijo global del API** (`API_PREFIX`).
 * Quien le antepone el prefijo es `jwtCookiePath`.
 *
 * La cadena vacía de `access` significa «todo el API»: la cookie de acceso viaja con
 * cualquier petición. La de refresco cuelga sólo del endpoint que la canjea, y ésa es la
 * razón de que estos valores existan: mantener un token de quince días fuera del resto del
 * tráfico.
 */
export enum JwtEndpoints {
	access = '',
	refresh = '/auth/refresh-session',
}
