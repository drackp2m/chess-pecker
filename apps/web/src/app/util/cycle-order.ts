import { TrainingPolicy } from '@app/definition/training-policy.constant';
import { shuffle } from '@app/util/shuffle';

export function cycleBlock(rating: number): number {
	return Math.floor(rating / TrainingPolicy.shuffleBlockSize) * TrainingPolicy.shuffleBlockSize;
}

export function buildCycleOrder<T extends { readonly rating: number }>(items: readonly T[]): T[] {
	const blocks = new Map<number, T[]>();

	for (const item of items) {
		const block = cycleBlock(item.rating);

		blocks.set(block, [...(blocks.get(block) ?? []), item]);
	}

	return [...blocks.keys()]
		.sort((one, other) => one - other)
		.flatMap((block) => shuffle(blocks.get(block) ?? []));
}
