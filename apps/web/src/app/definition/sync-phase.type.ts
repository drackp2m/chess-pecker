/**
 * Por dónde va el ciclo de sincronización. `idle` es antes de la primera pasada; las tres
 * de en medio son la pasada; y las tres últimas son sus finales, todos igual de finales:
 * `failed` y `offline` abren la puerta de arranque igual que `ready`, porque «no se sirven
 * datos hasta que termine» tiene que significar *hasta que termine*, con éxito o sin él.
 */
export type SyncPhase =
	'checking' | 'failed' | 'idle' | 'offline' | 'pulling' | 'pushing' | 'ready';

/** Los tres finales: la pasada ya no está corriendo. */
export function isSettledPhase(phase: SyncPhase): boolean {
	return 'ready' === phase || 'failed' === phase || 'offline' === phase;
}
