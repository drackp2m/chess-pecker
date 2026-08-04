import { JwtEndpoints } from '../definition/jwt-endpoints.enum';

/**
 * Compone el `Path` de una cookie de sesión colgándola del prefijo global del API.
 *
 * Los dos valores de `JwtEndpoints` llevaban el `/api` incrustado, y eso ataba `API_PREFIX` a
 * un valor concreto sin decirlo en ninguna parte: moverlo dejaba las cookies apuntando a una
 * ruta que ya no existe, el navegador dejaba de mandarlas y la sesión moría entera **sin un
 * solo error** ni en el servidor ni en el cliente.
 *
 * Normaliza el prefijo porque `Path` es estricto donde `setGlobalPrefix` es tolerante: éste
 * acepta `api`, `/api` y `/api/` como lo mismo, pero una cookie con `Path` relativo o vacío
 * la descarta el navegador. De ahí el `'/'` del final, que es el caso de un API servido sin
 * prefijo.
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
