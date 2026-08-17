/**
 * El modelo sincronizable que corre este servidor. Sube a mano cada vez que cambia la forma
 * de alguna de las ocho tablas del árbol.
 *
 * Viaja en `GET /sync` y el cliente lo compara con el suyo antes de subir: si el servidor va
 * por delante, el ciclo baja pero no sube. Es la protección más barata que hay contra un
 * cliente que la PWA dejó cacheado escribiendo el historial con un modelo viejo.
 */
export const SYNC_SCHEMA_VERSION = 1;
