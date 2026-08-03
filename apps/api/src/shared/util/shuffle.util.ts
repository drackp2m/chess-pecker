export function shuffle<T>(items: T[]): T[] {
	const shuffled = [...items];

	for (let index = shuffled.length - 1; 0 < index; index--) {
		const target = Math.floor(Math.random() * (index + 1));

		[shuffled[index], shuffled[target]] = [shuffled[target] as T, shuffled[index] as T];
	}

	return shuffled;
}
