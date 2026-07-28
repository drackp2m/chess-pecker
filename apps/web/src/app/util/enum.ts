import { EnumSelectOptions } from '@app/definition/enum-select-options.type';
import { Text } from '@app/util/text';

export abstract class Enum {
	static toSelectOptions<T extends Record<string, string | number>>(
		enumObj: T,
	): EnumSelectOptions<T> {
		return Object.keys(enumObj).map((key) => ({
			value: key,
			name: Text.fromUpperCaseToSentenceCase(key),
		}));
	}

	static emptyStringAs<T>(_type?: T): T {
		return '' as T;
	}

	static getEnumKeyByValue<T extends object>(enumObj: T, value: T[keyof T]): keyof T {
		return (Object.keys(enumObj).find((key) => enumObj[key as keyof T] === value) ?? '') as keyof T;
	}
}
