import { TrainingPolicy } from '@app/definition/training-policy.constant';
import { shuffle } from '@app/util/shuffle';

export function buildCycleOrder<T extends { readonly rating: number }>(items: readonly T[]): T[] {
	const blocks = new Map<number, T[]>();

	for (const item of items) {
		const block =
			Math.floor(item.rating / TrainingPolicy.shuffleBlockSize) * TrainingPolicy.shuffleBlockSize;

		blocks.set(block, [...(blocks.get(block) ?? []), item]);
	}

	return [...blocks.keys()]
		.sort((one, other) => one - other)
		.flatMap((block) => shuffle(blocks.get(block) ?? []));
}
