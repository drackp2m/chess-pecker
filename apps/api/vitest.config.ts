import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const swcPlugin = () =>
	swc.vite({
		module: { type: 'es6' },
		jsc: {
			target: 'es2023',
			parser: { syntax: 'typescript', decorators: true },
			transform: {
				legacyDecorator: true,
				decoratorMetadata: true,
				// Mirrors `useDefineForClassFields: false` in tsconfig.json — without it the
				// subclass fields of `CustomBaseEntity` are redefined as `undefined` after the
				// base constructor's `Object.assign(this, init)`. See the comment there.
				useDefineForClassFields: false,
			},
		},
	});

export default defineConfig({
	test: {
		coverage: {
			include: ['src/**/*.ts'],
			reportsDirectory: './coverage',
		},
		projects: [
			{
				plugins: [swcPlugin()],
				test: {
					name: 'unit',
					globals: true,
					environment: 'node',
					clearMocks: true,
					include: ['src/**/*.spec.ts'],
				},
			},
			{
				plugins: [swcPlugin()],
				test: {
					name: 'integration',
					globals: true,
					environment: 'node',
					clearMocks: true,
					include: ['src/**/*.test.ts'],
					globalSetup: ['./src/shared/test/reset-database.ts'],
					fileParallelism: false,
				},
			},
		],
	},
});
