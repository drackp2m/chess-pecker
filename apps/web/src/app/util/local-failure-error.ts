import type { TranslationRef } from '@app/definition/i18n.type';

export class LocalFailureError extends Error {
	readonly ref: TranslationRef;

	constructor(ref: TranslationRef, message: string) {
		super(message);

		this.name = 'LocalFailureError';
		this.ref = ref;
	}

	static toRef(error: unknown): TranslationRef | undefined {
		return error instanceof LocalFailureError ? error.ref : undefined;
	}
}
