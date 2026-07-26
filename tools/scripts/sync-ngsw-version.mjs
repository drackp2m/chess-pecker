import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const R = '\x1b[0m';
const B = '\x1b[1m';
const C = '\x1b[94m';
const G = '\x1b[92m';

const pkgPath = join(process.cwd(), 'package.json');
const ngswPath = join(process.cwd(), 'src', 'ngsw-config.json');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const ngswContent = readFileSync(ngswPath, 'utf8');
const ngsw = JSON.parse(ngswContent);

if (!pkg.version) {
	console.error('❌ "version" not found in package.json');
	process.exit(1);
}

const currentVersion = ngsw.appData?.version;

if (currentVersion === pkg.version) {
	console.log(`✅ ngsw-config.json appData version already at ${B}${G}${pkg.version}${R}.`);
	process.exit(0);
}

ngsw.appData = { ...ngsw.appData, version: pkg.version };

const indent = /^(\t| {2,4})/mu.exec(ngswContent)?.[1] ?? '\t';

writeFileSync(ngswPath, `${JSON.stringify(ngsw, null, indent)}\n`, 'utf8');

console.log(
	`✏️  Updated ngsw-config.json appData version: ${B}${C}${currentVersion ?? 'none'}${R} → ${B}${G}${pkg.version}${R}`,
);
