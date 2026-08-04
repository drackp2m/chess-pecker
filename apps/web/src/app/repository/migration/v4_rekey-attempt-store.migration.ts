import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

export const rekeyAttemptStoreMigration: Migration<AppSchema> = {
	version: 4,
	description: 'rekey attempt store by the run slot the attempt belongs to',
	apply: ({ database }) => {
		database.deleteObjectStore('attempt');

		const attempt = database.createObjectStore('attempt', { keyPath: 'uuid' });

		attempt.createIndex('slotId', 'slotId', { unique: true });
		attempt.createIndex('trainingUuid', 'trainingUuid');
	},
};
