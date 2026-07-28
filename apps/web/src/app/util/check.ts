export abstract class Check {
	static typedValueIsEmpty(value: unknown): boolean {
		return '' === (value as string) && null !== value;
	}

	static isFalseAsStringOrTrue(value: boolean | string): boolean {
		return 'string' === typeof value ? 'false' !== value : value;
	}
}
