export interface LocalRecord {
	readonly createdAt: Date;
	readonly updatedAt: Date;
	/** El uuid con el que nació aquí. Inmutable, y la clave de reintento de la subida. */
	readonly clientRef?: string;
	/** Existe en el servidor. Sella la copia, no la modifica: nunca toca `updatedAt`. */
	readonly syncedAt?: Date;
	/** Tiene cambios sin subir. Se pone en la primera escritura, se borra al confirmarse. */
	readonly pendingSince?: Date;
	/** El servidor la rechazó y no se va a reintentar. Se enseña, no se borra. */
	readonly rejectedAt?: Date;
	readonly rejectedReason?: string;
}
