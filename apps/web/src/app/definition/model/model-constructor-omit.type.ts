export type ModelConstructorOmit<T, K extends string = never> = Omit<
	T,
	'uuid' | 'createdAt' | 'updatedAt' | 'toObject' | 'with' | K
>;
