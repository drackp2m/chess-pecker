import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const fixMode = process.argv.includes('--fix');
const root = process.cwd();
const rootPackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const expected = rootPackage.devDependencies?.typescript;

if (!expected || !/^\d+\.\d+\.\d+$/.test(expected)) {
	console.error('❌ El package.json raíz debe definir una versión exacta de TypeScript.');
	process.exit(1);
}

const packagePaths = [];

for (const directory of ['apps', 'libs']) {
	const directoryPath = join(root, directory);

	if (!existsSync(directoryPath)) {
		continue;
	}

	for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			const packagePath = join(directoryPath, entry.name, 'package.json');

			if (existsSync(packagePath)) {
				packagePaths.push(packagePath);
			}
		}
	}
}

const mismatches = [];

for (const packagePath of packagePaths) {
	const packageJson = readFileSync(packagePath, 'utf8');
	const packageData = JSON.parse(packageJson);
	const found = packageData.devDependencies?.typescript;

	if (found !== expected) {
		mismatches.push({ packagePath, packageJson, found });
	}
}

if (!mismatches.length) {
	console.log(`✅ Todos los proyectos usan TypeScript ${expected}.`);
	process.exit(0);
}

if (fixMode) {
	for (const { packagePath, packageJson, found } of mismatches) {
		if (!found) {
			console.error(`⛔ Falta la dependencia TypeScript: ${packagePath}`);
			continue;
		}

		const escaped = found.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const fixed = packageJson.replace(
			new RegExp(`("typescript"\\s*:\\s*")${escaped}("\\s*,?)`),
			`$1${expected}$2`,
		);

		writeFileSync(packagePath, fixed, 'utf8');
		console.log(`✏️  Corregido ${packagePath}`);
	}

	if (mismatches.some(({ found }) => !found)) {
		process.exit(1);
	}

	console.log(`\n✅ Versiones de TypeScript actualizadas a ${expected}.`);
	process.exit(0);
}

for (const { packagePath, found } of mismatches) {
	console.error(`📄 ${packagePath}: ${found ?? 'falta'} (se esperaba ${expected})`);
}

console.error('\n⛔ Las versiones de TypeScript no coinciden. Usa --fix para actualizarlas.');
process.exit(1);
