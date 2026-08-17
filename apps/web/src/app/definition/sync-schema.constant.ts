/**
 * El modelo sincronizable que entiende este cliente. Va a la par de `SYNC_SCHEMA_VERSION`
 * del API y sube a mano cuando cambia la forma de alguna de las ocho tablas del árbol.
 *
 * Se compara contra el que trae `GET /sync` antes de subir: si el servidor va por delante,
 * el ciclo baja pero no sube. Es lo que impide que un cliente que la PWA dejó cacheado
 * escriba el historial con un modelo viejo.
 */
export const SYNC_SCHEMA_VERSION = 1;
