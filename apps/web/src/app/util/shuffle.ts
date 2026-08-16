import { Generate } from '@app/util/generate';

export function shuffle<T>(items: readonly T[]): T[] {
	const shuffled = [...items];

	for (let index = shuffled.length - 1; 0 < index; index--) {
		const target = Generate.randomNumber(0, index);

		[shuffled[index], shuffled[target]] = [shuffled[target] as T, shuffled[index] as T];
	}

	return shuffled;
}
