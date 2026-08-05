import { AppSchemaV5 } from '@app/repository/definition/app-schema.interface';
import { AttemptRowV4 } from '@app/repository/definition/attempt-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

/**
 * Adding a field is free —the rows that lack it simply lack it— but dropping one is
 * not: `movesPlayed` would stay on disk forever, saying something the type no longer
 * says. So the rows are walked and rewritten in the shape the code now reads, with an
 * empty record, which is the truth about an attempt nobody was recording.
 */
export const recordAttemptSolveMigration: Migration<AppSchemaV5> = {
	version: 5,
	description: 'replace the attempt move count with the solve record',
	apply: async ({ transaction }) => {
		const store = transaction.objectStore('attempt');

		for (let cursor = await store.openCursor(); null !== cursor; cursor = await cursor.continue()) {
			const { movesPlayed: _movesPlayed, ...row } = cursor.value as unknown as AttemptRowV4;

			await cursor.update({ ...row, record: [], explorations: [] });
		}
	},
};
