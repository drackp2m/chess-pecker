/**
 * A string that is only decided in TypeScript but written in the template: the code picks
 * the key and the holes to fill, `| transloco` resolves it where the language is known.
 */
export interface TranslationRef {
	readonly key: string;
	readonly params?: Record<string, unknown>;
}
