import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

export const createLocalTrainingStoresMigration: Migration<AppSchema> = {
	version: 11,
	description: 'create the local training stores and index puzzles by rating',
	apply: ({ database, transaction }) => {
		transaction.objectStore('puzzle').createIndex('rating', 'rating');

		database.deleteObjectStore('cycle');

		const training = database.createObjectStore('training', { keyPath: 'uuid' });
		training.createIndex('status', 'status');

		const goal = database.createObjectStore('trainingGoal', { keyPath: 'uuid' });
		goal.createIndex('trainingUuid', 'trainingUuid');

		const round = database.createObjectStore('calibrationRound', { keyPath: 'uuid' });
		round.createIndex('trainingUuid', 'trainingUuid');

		const roundPuzzle = database.createObjectStore('calibrationPuzzle', { keyPath: 'uuid' });
		roundPuzzle.createIndex('roundUuid', 'roundUuid');

		const trainingPuzzle = database.createObjectStore('trainingPuzzle', { keyPath: 'uuid' });
		trainingPuzzle.createIndex('trainingUuid', 'trainingUuid');

		const cycle = database.createObjectStore('cycle', { keyPath: 'uuid' });
		cycle.createIndex('trainingUuid', 'trainingUuid');

		const cycleItem = database.createObjectStore('cycleItem', { keyPath: 'uuid' });
		cycleItem.createIndex('cycleUuid', 'cycleUuid');
	},
};
