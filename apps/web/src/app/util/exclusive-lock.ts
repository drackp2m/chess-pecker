/** El candado de la sincronización: uno solo, y para el ciclo entero. */
export const SYNC_LOCK = 'chesspecker-sync';

const queues = new Map<string, Promise<unknown>>();

/**
 * Una sección crítica compartida por todas las pestañas del mismo origen. Dos pestañas
 * arrancando a la vez subirían el mismo árbol dos veces: la clave de reintento evita el
 * duplicado en el servidor, pero no el trabajo ni las carreras entre las dos respuestas.
 *
 * Esperar es lo correcto y no bloquea: la puerta de arranque tiene su propio tope, así que
 * la segunda pestaña abre igual aunque la primera siga sincronizando.
 */
export async function withExclusiveLock<T>(name: string, action: () => Promise<T>): Promise<T> {
	const locks: LockManager | undefined = (navigator as Partial<Navigator>).locks;

	if (undefined === locks) {
		return runQueued(name, action);
	}

	const result: unknown = await locks.request(name, action);

	return result as T;
}

/**
 * Sin `navigator.locks` —contexto inseguro, o un navegador que no lo trae— sólo se puede
 * serializar dentro de la pestaña. Es menos de lo que promete el candado, pero es lo que
 * hay, y la subida sigue siendo idempotente para lo demás.
 */
async function runQueued<T>(name: string, action: () => Promise<T>): Promise<T> {
	const previous = queues.get(name) ?? Promise.resolve();
	const next = previous.then(action, action);

	queues.set(
		name,
		next.catch(() => undefined),
	);

	return next;
}
