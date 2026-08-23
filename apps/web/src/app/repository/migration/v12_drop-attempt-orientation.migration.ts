import { AppSchemaV14 } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

/**
 * Orientation stops being stored: the player's colour comes from the FEN, and all the field
 * added was the manual flip, which belongs to the moment and not to the exercise.
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
