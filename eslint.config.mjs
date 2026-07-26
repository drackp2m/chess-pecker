/* eslint-disable max-lines */
import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import angularEslint from 'angular-eslint';
import eslintPluginImportX from 'eslint-plugin-import-x';
import eslintPluginRxjs from 'eslint-plugin-rxjs-updated';
import eslintPluginSonarjs from 'eslint-plugin-sonarjs';
import eslintPluginUnusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import typescriptEslint from 'typescript-eslint';

import angularCustomPlugin from './tools/eslint-plugins/angular/index.js';

function eslintErrorsToWarnings(rules) {
	return Object.fromEntries(
		Object.entries(rules).map(([ruleName, ruleValue]) => {
			if (Array.isArray(ruleValue)) {
				ruleValue[0] = ruleValue[0]?.replace('error', 'warn');
			} else {
				ruleValue = ruleValue?.replace('error', 'warn');
			}

			return [ruleName, ruleValue];
		}),
	);
}

function transformEslintConfigs(config) {
	if (Array.isArray(config)) {
		return config.map((item) => transformEslintConfigs(item));
	}

	if (config && 'object' === typeof config) {
		return Object.fromEntries(
			Object.entries(config).map(([key, value]) => {
				if ('rules' === key) {
					return [key, eslintErrorsToWarnings(value)];
				} else {
					return [key, value];
				}
			}),
		);
	}

	return config;
}

export default typescriptEslint.config(
	{
		ignores: [
			'.angular/**',
			'.pnpm-store/**',
			'.devcontainers/**',
			'node_modules/**',
			'dist/**',
			'coverage/**',
		],
	},
	// ── Global ignores & settings ──────────────────────────────────────────────
	{
		settings: {
			'import-x/internal-regex': '^@app/',
		},
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},

	// ── Base: shared rules for TS + JS ─────────────────────────────────────────
	{
		name: 'Base',
		files: ['**/*.ts', '**/*.mts', '**/*.js', '**/*.mjs'],
		plugins: {
			'@stylistic': stylistic,
			'import-x': eslintPluginImportX,
			'unused-imports': eslintPluginUnusedImports,
		},
		rules: {
			// Imports
			'sort-imports': ['warn', { ignoreDeclarationSort: true, ignoreMemberSort: false }],
			'unused-imports/no-unused-imports': 'warn',
			'import-x/no-duplicates': 'warn',
			'import-x/order': [
				'warn',
				{
					'newlines-between': 'always',
					alphabetize: {
						order: 'asc',
					},
				},
			],

			// Format
			'@stylistic/lines-between-class-members': ['warn', 'always', { exceptAfterSingleLine: true }],
			'@stylistic/padding-line-between-statements': [
				'warn',
				{
					blankLine: 'always',
					prev: '*',
					next: ['if', 'for', 'while', 'switch', 'try', 'throw', 'return', 'break', 'continue'],
				},
			],

			// General style
			curly: ['warn', 'all'],
			eqeqeq: ['warn', 'always'],
			yoda: ['warn', 'always'],
			'no-empty': 'warn',
			'no-implicit-coercion': ['warn', { boolean: true }],
			'no-extra-boolean-cast': 'warn',
		},
	},

	// ── App source: enforce path aliases ───────────────────────────────────────
	{
		name: 'App source',
		files: ['src/**/*.ts'],
		rules: {
			'no-restricted-imports': [
				'warn',
				{
					patterns: [
						{
							group: ['./*', '../*'],
							message: 'Use path aliases instead of relative imports',
						},
					],
				},
			],
		},
	},

	// ── TypeScript ─────────────────────────────────────────────────────────────
	{
		name: 'TypeScript',
		files: ['**/*.ts', '**/*.mts'],
		plugins: {
			sonarjs: eslintPluginSonarjs,
			rxjs: eslintPluginRxjs,
			'angular-custom': angularCustomPlugin,
		},
		extends: [
			transformEslintConfigs(eslint.configs.recommended),
			transformEslintConfigs(typescriptEslint.configs.recommendedTypeChecked),
			transformEslintConfigs(typescriptEslint.configs.strictTypeChecked),
			transformEslintConfigs(typescriptEslint.configs.stylisticTypeChecked),
			transformEslintConfigs(eslintPluginRxjs.configs.recommended),
			transformEslintConfigs(angularEslint.configs.tsRecommended),
		],
		processor: angularEslint.processInlineTemplates,
		rules: {
			...eslintErrorsToWarnings(eslintPluginSonarjs.configs.recommended.rules),

			// Angular
			'@angular-eslint/directive-selector': [
				'warn',
				{ type: 'attribute', prefix: 'app', style: 'camelCase' },
			],
			'@angular-eslint/component-selector': [
				'warn',
				{ type: 'element', prefix: 'app', style: 'kebab-case' },
			],
			'@angular-eslint/component-class-suffix': [
				'warn',
				{ suffixes: ['Layout', 'Page', 'Modal', 'Component'] },
			],
			'angular-custom/no-page-selector': 'warn',
			'angular-custom/component-property-order': [
				'warn',
				['selector', 'templateUrl', 'styleUrl', 'imports'],
			],
			'angular-custom/no-forbidden-component-property': [
				'warn',
				['animations', 'template', 'styles'],
			],

			// TypeScript
			'@typescript-eslint/no-extraneous-class': 'off',
			'@typescript-eslint/unbound-method': 'off',
			'@typescript-eslint/no-inferrable-types': 'warn',
			'@typescript-eslint/no-unnecessary-boolean-literal-compare': 'warn',
			'@typescript-eslint/strict-boolean-expressions': [
				'warn',
				{
					allowNullableObject: false,
					allowNumber: false,
					allowString: false,
				},
			],
			'@typescript-eslint/member-ordering': [
				'warn',
				{
					default: [
						'signature',
						'field',
						'constructor',
						'decorated-method',
						'method',
						'static-method',
						'abstract-method',
						'protected-method',
						'private-method',
					],
				},
			],
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
				},
			],

			// SonarJS
			'sonarjs/no-unused-vars': 'off',
			'sonarjs/unused-import': 'off',
			'sonarjs/no-dead-store': 'off',
			'sonarjs/todo-tag': 'off',
			'sonarjs/fixme-tag': 'off',
			'sonarjs/deprecation': 'off',
			'no-unused-private-class-members': 'warn',
		},
	},

	// ── JavaScript ─────────────────────────────────────────────────────────────
	{
		name: 'JavaScript',
		files: ['**/*.js', '**/*.mjs'],
		extends: [transformEslintConfigs(eslint.configs.recommended)],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
		rules: {
			'@typescript-eslint/no-require-imports': 'off',
		},
	},

	// ── HTML ───────────────────────────────────────────────────────────────────
	{
		name: 'HTML',
		files: ['**/*.html'],
		extends: [
			...angularEslint.configs.templateRecommended,
			...angularEslint.configs.templateAccessibility,
		],
		rules: {
			'@angular-eslint/template/click-events-have-key-events': 'warn',
			'@angular-eslint/template/interactive-supports-focus': 'warn',
			'@angular-eslint/template/elements-content': [
				'warn',
				{
					allowList: ['appThemed'],
				},
			],
		},
	},

	// ── Tests ──────────────────────────────────────────────────────────────────
	{
		name: 'Tests',
		files: ['**/*.spec.ts', '**/*.spec.js', '**/*.test.ts', '**/*.test.js'],
		rules: {
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'sonarjs/no-hardcoded-credentials': 'off',
			'sonarjs/no-hardcoded-passwords': 'off',
			'sonarjs/no-hardcoded-secrets': 'off',
			'sonarjs/no-skipped-tests': 'off',
		},
	},

	// ── Complexity ─────────────────────────────────────────────────────────────
	{
		name: 'Complexity',
		files: ['**/*.ts', '**/*.mts', '**/*.js', '**/*.mjs'],
		ignores: ['**/*.spec.ts', '**/*.spec.js', '.angular/**'],
		rules: {
			'max-lines': ['warn', { max: 250, skipComments: true }],
			'max-lines-per-function': ['warn', { max: 75, skipComments: true, IIFEs: true }],
		},
	},
);
