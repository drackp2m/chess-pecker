const FALLBACK_KEYS = [
	'animations',
	'changeDetection',
	'encapsulation',
	'exportAs',
	'host',
	'hostDirectives',
	'imports',
	'inputs',
	'jit',
	'outputs',
	'preserveWhitespaces',
	'providers',
	'queries',
	'schemas',
	'selector',
	'standalone',
	'styleUrl',
	'styleUrls',
	'styles',
	'template',
	'templateUrl',
	'viewProviders',
];

function resolveKeysFromTypeScript() {
	const ts = require('typescript');
	const probe = require('path').join(process.cwd(), '__angular-component-keys-probe__.ts');
	const source = 'import { Component } from "@angular/core"; export type K = keyof Component;';

	const host = ts.createCompilerHost({});
	const readFile = host.readFile.bind(host);
	const getSourceFile = host.getSourceFile.bind(host);

	host.fileExists = (file) => probe === file || ts.sys.fileExists(file);
	host.readFile = (file) => (probe === file ? source : readFile(file));
	host.getSourceFile = (file, languageVersion, ...rest) =>
		probe === file
			? ts.createSourceFile(file, source, languageVersion, true)
			: getSourceFile(file, languageVersion, ...rest);

	const program = ts.createProgram(
		[probe],
		{
			module: ts.ModuleKind.ESNext,
			moduleResolution: ts.ModuleResolutionKind.Bundler,
			target: ts.ScriptTarget.ESNext,
			baseUrl: process.cwd(),
			skipLibCheck: true,
		},
		host,
	);

	const checker = program.getTypeChecker();
	const sourceFile = program.getSourceFile(probe);
	const alias = sourceFile?.statements.find((s) => ts.isTypeAliasDeclaration(s));

	if (!alias) {
		return null;
	}

	const type = checker.getTypeAtLocation(alias.type);

	if (!type.isUnion()) {
		return null;
	}

	const keys = type.types
		.map((member) => member.value)
		.filter((value) => 'string' === typeof value);

	return 0 === keys.length ? null : keys.sort();
}

let cached;

function getComponentMetadataKeys() {
	if (cached) {
		return cached;
	}

	try {
		cached = resolveKeysFromTypeScript() ?? FALLBACK_KEYS;
	} catch {
		cached = FALLBACK_KEYS;
	}

	return cached;
}

module.exports = { getComponentMetadataKeys, FALLBACK_KEYS };
