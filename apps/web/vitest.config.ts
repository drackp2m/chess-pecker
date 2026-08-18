import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		{
			name: 'chesspecker:vitest-project-name',
			config: () => ({ test: { name: { label: 'unit', color: 'yellow' } } }),
		},
	],
});
