import { readFileSync } from 'node:fs';

vi.mock('node:fs', () => ({ readFileSync: vi.fn() }));

const loadAppVersion = async (): Promise<() => string> => {
	const module = await import('./app-version.js');

	return module.appVersion;
};

describe('appVersion', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.mocked(readFileSync).mockReset();
	});

	it('reads the version from the root package.json', async () => {
		vi.mocked(readFileSync).mockReturnValue('{"version":"1.6.3"}');

		const appVersion = await loadAppVersion();

		expect(appVersion()).toBe('1.6.3');
		expect(readFileSync).toHaveBeenCalledWith('../../package.json', 'utf8');
	});

	it('reads the file once however many times it is asked', async () => {
		vi.mocked(readFileSync).mockReturnValue('{"version":"1.6.3"}');

		const appVersion = await loadAppVersion();

		appVersion();
		appVersion();
		appVersion();

		expect(readFileSync).toHaveBeenCalledTimes(1);
	});

	it('falls back to `unknown` when the file cannot be read', async () => {
		vi.mocked(readFileSync).mockImplementation(() => {
			throw new Error('ENOENT');
		});

		const appVersion = await loadAppVersion();

		expect(appVersion()).toBe('unknown');
	});

	it('falls back to `unknown` when the file is not valid JSON', async () => {
		vi.mocked(readFileSync).mockReturnValue('not json');

		const appVersion = await loadAppVersion();

		expect(appVersion()).toBe('unknown');
	});

	it.each(['null', '"1.6.3"', '{}', '{"version":163}'])(
		'falls back to `unknown` when the parsed %s carries no version string',
		async (contents) => {
			vi.mocked(readFileSync).mockReturnValue(contents);

			const appVersion = await loadAppVersion();

			expect(appVersion()).toBe('unknown');
		},
	);
});
