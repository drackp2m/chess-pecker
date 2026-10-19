import { vi } from 'vitest';

export const countDateTimeFormats = (): readonly (string | undefined)[] => {
	const zones: (string | undefined)[] = [];
	const Native = Intl.DateTimeFormat;

	class CountingDateTimeFormat extends Native {
		constructor(...args: ConstructorParameters<typeof Native>) {
			super(...args);
			zones.push(args[1]?.timeZone);
		}
	}

	vi.stubGlobal('Intl', Object.create(Intl, { DateTimeFormat: { value: CountingDateTimeFormat } }));

	return zones;
};
