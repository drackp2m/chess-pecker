import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

/**
 * Los intentos que ya se restauraron entraron sin su sitio en la pasada, que entonces no
 * viajaba. Olvidar el corte los hace volver una vez, que es cuando la fila lo aprende.
 */
export const resetAttemptCursorMigration: Migration<AppSchema> = {
	version: 14,
	description: 'forget the restore cursor so the history comes back once with its positions',
	apply: async ({ transaction }) => {
		await transaction.objectStore('attemptCursor').clear();
	},
};
