import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const fixMode = process.argv.includes('--fix');
const root = process.cwd();
const rootPackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const expected = rootPackage.devDependencies?.typescript;

if (!expected || !/^\d+\.\d+\.\d+$/.test(expected)) {
	console.error('❌ The root package.json must define an exact TypeScript version.');
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
	console.log(`✅ All projects use TypeScript ${expected}.`);
	process.exit(0);
}

if (fixMode) {
	for (const { packagePath, packageJson, found } of mismatches) {
		if (!found) {
			console.error(`⛔ TypeScript dependency is missing: ${packagePath}`);

			continue;
		}

		const escaped = found.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const fixed = packageJson.replace(
			new RegExp(`("typescript"\\s*:\\s*")${escaped}("\\s*,?)`),
			`$1${expected}$2`,
		);

		writeFileSync(packagePath, fixed, 'utf8');
		console.log(`✏️  Fixed ${packagePath}`);
	}

	if (mismatches.some(({ found }) => !found)) {
		process.exit(1);
	}

	console.log(`\n✅ TypeScript versions updated to ${expected}.`);
	process.exit(0);
}

for (const { packagePath, found } of mismatches) {
	console.error(`📄 ${packagePath}: ${found ?? 'missing'} (expected ${expected})`);
}

console.error('\n⛔ TypeScript versions do not match. Use --fix to update them.');
process.exit(1);
