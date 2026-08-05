import { PuzzleClosure } from '@app/definition/puzzle.type';
import { AppSchema } from '@app/repository/definition/app-schema.interface';
import { AttemptRow, AttemptRowV5 } from '@app/repository/definition/attempt-schema.interface';
import { Migration } from '@app/repository/definition/migration.interface';

type Closure = Pick<AttemptRow, 'closure' | 'hintUsed' | 'mistakeCount'>;

/**
 * How an attempt written before v6 ended, which its verdict gives back exactly: back then
 * the exercise was over the moment it was graded, so a solved one was found first try with
 * no miss behind it, and a failed one ended on that single miss without the line ever being
 * played out —which is what giving up is. Nothing was ever hinted, because there was no
 * hint to take.
 */
function closeAsGraded(solved: boolean | undefined): Closure {
	if (undefined === solved) {
		return { closure: 'open', hintUsed: false, mistakeCount: 0 };
	}

	const closure: PuzzleClosure = solved ? 'found' : 'revealed';

	return { closure, hintUsed: false, mistakeCount: solved ? 0 : 1 };
}

export const recordAttemptClosureMigration: Migration<AppSchema> = {
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
