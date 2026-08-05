import { AppSchemaV3 } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

export const createTrainingStoresMigration: Migration<AppSchemaV3> = {
	version: 3,
	description: 'create puzzle, puzzle set, cycle and attempt stores',
	apply: ({ database }) => {
		const puzzle = database.createObjectStore('puzzle', { keyPath: 'lichessId' });
		puzzle.createIndex('uuid', 'uuid', { unique: true });

		database.createObjectStore('puzzleSet', { keyPath: 'uuid' });

		const cycle = database.createObjectStore('cycle', { keyPath: 'uuid' });
		cycle.createIndex('setId', 'setId');

		const attempt = database.createObjectStore('attempt', { keyPath: 'uuid' });
		attempt.createIndex('cycleId', 'cycleId');
		attempt.createIndex('lichessId-cycleId', ['lichessId', 'cycleId']);
	},
};
