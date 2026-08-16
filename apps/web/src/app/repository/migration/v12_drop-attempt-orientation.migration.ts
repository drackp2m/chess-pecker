import { AppSchemaV14 } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

/**
 * La orientación deja de guardarse: el color del jugador sale del FEN —es el contrario al
 * del turno, porque la posición es la de antes de la jugada del rival— y lo único que la
 * fila añadía era el volteo manual, que es del momento y no del ejercicio.
 */
export const dropAttemptOrientationMigration: Migration<AppSchemaV14> = {
	version: 12,
	description: 'drop the stored board orientation from the attempts',
	apply: async ({ transaction }) => {
		const store = transaction.objectStore('attempt');

		for (let cursor = await store.openCursor(); null !== cursor; cursor = await cursor.continue()) {
			const { orientation, ...row } = cursor.value as typeof cursor.value & {
				orientation?: unknown;
			};

			if (undefined !== orientation) {
				await cursor.update(row);
			}
		}
	},
};
