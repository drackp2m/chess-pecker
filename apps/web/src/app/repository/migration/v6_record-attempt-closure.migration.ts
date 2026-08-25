import { PuzzleClosure } from '@app/definition/puzzle.type';
import { AppSchemaV14 } from '@app/repository/definition/app-schema.interface';
import { AttemptRowV14, AttemptRowV5 } from '@app/repository/definition/attempt-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

type Closure = Pick<AttemptRowV14, 'closure' | 'hintUsed' | 'mistakeCount'>;

/**
 * How a pre-v6 attempt ended, which its verdict gives back exactly: the exercise was over
 * the moment it was graded, and there was no hint to take.
 */
function closeAsGraded(solved: boolean | undefined): Closure {
	if (undefined === solved) {
		return { closure: 'open', hintUsed: false, mistakeCount: 0 };
	}

	const closure: PuzzleClosure = solved ? 'found' : 'revealed';

	return { closure, hintUsed: false, mistakeCount: solved ? 0 : 1 };
}

export const recordAttemptClosureMigration: Migration<AppSchemaV14> = {
	version: 6,
	description: 'record how the attempt was closed, apart from how it was graded',
	apply: async ({ transaction }) => {
		const store = transaction.objectStore('attempt');

		for (let cursor = await store.openCursor(); null !== cursor; cursor = await cursor.continue()) {
			const row = cursor.value as unknown as AttemptRowV5;

			await cursor.update({ ...row, ...closeAsGraded(row.solved) });
		}
	},
};
