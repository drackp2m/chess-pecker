export const SyncPolicy = {
	/**
	 * Filas pendientes por petición. El árbol entero de una cuenta veterana son miles de
	 * huecos y sus partidas: lo que no cabe se queda para la pasada siguiente, que es inocuo
	 * porque la subida es idempotente.
	 */
	pushBatchSize: 200,

	/** Tope de peticiones por pasada, para que un árbol que no avanza no gire para siempre. */
	maxRequestsPerRun: 50,

	/** Espera antes de cada reintento, en orden: su longitud decide cuántos hay. */
	retryBackoffMs: [1000, 4000],

	/** Tope duro del arranque: pasado esto la puerta se abre, con éxito o sin él. */
	startupTimeoutMs: 15000,

	/** A partir de aquí una fila lleva demasiado esperando y hay que decirlo. */
	staleAfterMs: 7 * 24 * 60 * 60 * 1000,
} as const;
