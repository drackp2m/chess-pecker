import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs, parseEnv } from 'node:util';

import { c } from './lint/lint-report.mjs';

const DEFAULT_CSV_PATH = 'ideas/puzzles/selected_puzzles.csv';
const BATCH_SIZE = 2000;
const ESC = '\x1b';
const CTRL_C = '\u0003';
const CTRL_D = '\u0004';
const SUBMIT_KEYS = new Set(['\n', '\r', CTRL_D]);
const BACKSPACE_KEYS = new Set(['\u007f', '\b']);
const PROTOCOL = /^https?$/;
const HOSTNAME =
	/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;
const PREFIX = /^\/(?:[\w.~-]+(?:\/[\w.~-]+)*)?$/;
const OPTIONS = {
	protocol: { type: 'string' },
	domain: { type: 'string' },
	port: { type: 'string' },
	prefix: { type: 'string' },
	csv: { type: 'string' },
	username: { type: 'string' },
	password: { type: 'string' },
	help: { type: 'boolean', short: 'h' },
};
const PASSWORD_ENV = 'IMPORT_PUZZLES_PASSWORD';
const USAGE = [
	'Usage: pnpm import:puzzles [options]',
	'',
	'  --protocol <http|https>',
	'  --domain <hostname>',
	'  --port <1-65535>',
	'  --prefix </path>',
	'  --csv <file>',
	'  --username <name>',
	'  -h, --help',
	'',
	`The password is only read from ${PASSWORD_ENV}.`,
	'In a terminal, whatever is missing is asked for, suggesting the local values',
	'(.env); an empty answer takes the suggestion. Without a terminal, every option',
	`and ${PASSWORD_ENV} are required.`,
].join('\n');

const required = (value) => ('' === value ? 'Required.' : undefined);

const CREDENTIAL_FIELDS = [
	{ key: 'username', label: 'Admin username', validate: required },
	{
		key: 'password',
		source: PASSWORD_ENV,
		label: 'Admin password',
		hidden: true,
		validate: required,
	},
];

const sourceOf = (field) => field.source ?? `--${field.key}`;

function localDefaults() {
	const envPath = join(process.cwd(), '.env');
	const env = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};

	return {
		protocol: env.API_PROTOCOL ?? 'https',
		domain: env.API_DOMAIN ?? 'localhost',
		port: env.API_PORT ?? '3000',
		prefix: env.API_PREFIX ?? '/api',
	};
}

function validatePort(value) {
	const port = Number(value);

	return /^\d+$/.test(value) && 1 <= port && 65535 >= port
		? undefined
		: 'Must be a number between 1 and 65535.';
}

function validateCsv(value) {
	const path = resolve(process.cwd(), value);

	if (!existsSync(path) || !statSync(path).isFile()) {
		return 'File not found.';
	}

	return value.endsWith('.csv') ? undefined : 'Must be a .csv file.';
}

function targetFields(defaults) {
	return [
		{
			key: 'protocol',
			label: 'API protocol',
			placeholder: defaults.protocol,
			validate: (value) => (PROTOCOL.test(value) ? undefined : 'Must be http or https.'),
		},
		{
			key: 'domain',
			label: 'API domain',
			placeholder: defaults.domain,
			validate: (value) => (HOSTNAME.test(value) ? undefined : 'Not a valid hostname.'),
		},
		{ key: 'port', label: 'API port', placeholder: defaults.port, validate: validatePort },
		{
			key: 'prefix',
			label: 'API prefix',
			placeholder: defaults.prefix,
			validate: (value) => (PREFIX.test(value) ? undefined : 'Must start with /, as in /api.'),
		},
		{ key: 'csv', label: 'CSV file', placeholder: DEFAULT_CSV_PATH, validate: validateCsv },
	];
}

const shownOf = (field, value) => (field.hidden ? '*'.repeat(value.length) : value);

function render(field, input) {
	const placeholder = field.placeholder ?? '';
	const hint =
		'' === input && '' !== placeholder
			? `${c.dim}${placeholder}${c.reset}${ESC}[${placeholder.length}D`
			: '';

	process.stdout.write(
		`\r${ESC}[K${c.bold}${field.label}:${c.reset} ${shownOf(field, input)}${hint}`,
	);
}

function applyKey(state, char) {
	if (CTRL_C === char) {
		process.stdout.write('\n');
		process.exit(1);
	}

	if (SUBMIT_KEYS.has(char)) {
		return true;
	}

	if (BACKSPACE_KEYS.has(char)) {
		state.input = state.input.slice(0, -1);
	} else if (' ' <= char) {
		state.input += char;
	}

	return false;
}

function valueOf(field, input) {
	const value = field.hidden ? input : input.trim();

	return '' === value ? (field.placeholder ?? '') : value;
}

function readField(field) {
	const { stdin } = process;
	const state = { input: '' };

	return new Promise((done) => {
		const onData = (chunk) => {
			if (chunk.startsWith(ESC)) {
				return;
			}

			for (const char of chunk) {
				if (applyKey(state, char)) {
					stdin.setRawMode(false);
					stdin.pause();
					stdin.removeListener('data', onData);
					done(valueOf(field, state.input));

					return;
				}
			}

			render(field, state.input);
		};

		stdin.setRawMode(true);
		stdin.setEncoding('utf8');
		stdin.resume();
		stdin.on('data', onData);
		render(field, state.input);
	});
}

function printAnswer(field, value) {
	process.stdout.write(`\r${ESC}[K${c.bold}${field.label}:${c.reset} ${shownOf(field, value)}\n`);
}

async function ask(field) {
	while (true) {
		const value = await readField(field);
		const error = field.validate(value);

		printAnswer(field, value);

		if (undefined === error) {
			return value;
		}

		console.log(`  ${c.red}✖ ${error}${c.reset}`);
	}
}

async function resolveField(field, given) {
	const value = given[field.key];

	if (undefined === value) {
		return ask(field);
	}

	const error = field.validate(value);

	if (undefined !== error) {
		throw new Error(`Invalid ${sourceOf(field)} "${shownOf(field, value)}": ${error}`);
	}

	printAnswer(field, value);

	return value;
}

async function resolveAll(fields, given) {
	const answers = {};

	for (const field of fields) {
		answers[field.key] = await resolveField(field, given);
	}

	return answers;
}

function assertComplete(fields, given) {
	const missing = fields
		.filter((field) => undefined === given[field.key])
		.map((field) => sourceOf(field));

	if (0 < missing.length) {
		throw new Error(
			`Not an interactive terminal, so nothing can be asked: missing ${missing.join(', ')}.\n\n${USAGE}`,
		);
	}
}

function apiUrlOf({ protocol, domain, port, prefix }) {
	const { origin } = new URL(`${protocol}://${domain}:${port}`);

	return '/' === prefix ? origin : `${origin}${prefix}`;
}

function parseCsv(content) {
	const [, ...rows] = content.trim().split(/\r?\n/);

	return rows.map((line) => {
		const [lichessId, fen, moves, rating, themes] = line.split(',');

		return {
			lichessId,
			fen,
			moves: moves.split(' '),
			rating: Number(rating),
			themes: themes.split(' '),
		};
	});
}

function chunk(array, size) {
	const chunks = [];

	for (let index = 0; index < array.length; index += size) {
		chunks.push(array.slice(index, index + size));
	}

	return chunks;
}

function extractCookies(response) {
	const setCookies = response.headers.getSetCookie?.() ?? [];

	return setCookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

async function login(apiUrl, username, password) {
	const response = await fetch(`${apiUrl}/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password }),
	});

	if (!response.ok) {
		throw new Error(`Login failed: ${response.status} ${await response.text()}`);
	}

	const cookies = extractCookies(response);

	if (!cookies) {
		throw new Error('Login succeeded but no session cookie was returned.');
	}

	return cookies;
}

async function importBatch(apiUrl, cookies, puzzles) {
	const response = await fetch(`${apiUrl}/puzzle/import`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Cookie: cookies },
		body: JSON.stringify({ puzzles }),
	});

	if (!response.ok) {
		throw new Error(`Import failed: ${response.status} ${await response.text()}`);
	}

	return response.json();
}

async function importAll(apiUrl, cookies, puzzles) {
	const batches = chunk(puzzles, BATCH_SIZE);
	let imported = 0;

	for (const [index, batch] of batches.entries()) {
		console.log(`⬆️  Importing batch ${index + 1}/${batches.length} (${batch.length} puzzles)...`);

		const result = await importBatch(apiUrl, cookies, batch);

		imported += result.imported;
		console.log(`   ✅ ${result.imported} upserted.`);
	}

	return imported;
}

async function main() {
	const { values } = parseArgs({ options: OPTIONS });

	if (values.help) {
		console.log(USAGE);

		return;
	}

	if (undefined !== values.password) {
		throw new Error(`Never pass the password as a flag: set ${PASSWORD_ENV} instead.`);
	}

	const given = { ...values, password: process.env[PASSWORD_ENV] };
	const targets = targetFields(localDefaults());

	if (true !== process.stdin.isTTY) {
		assertComplete([...targets, ...CREDENTIAL_FIELDS], given);
	}

	const target = await resolveAll(targets, given);
	const apiUrl = apiUrlOf(target);

	console.log(`\n🎯 Target: ${c.bold}${apiUrl}${c.reset}`);
	console.log(`📄 Reading ${target.csv}...`);
	const puzzles = parseCsv(readFileSync(resolve(process.cwd(), target.csv), 'utf8'));

	console.log(`🧩 Parsed ${puzzles.length} puzzles.\n`);

	const { username, password } = await resolveAll(CREDENTIAL_FIELDS, given);

	console.log(`\n🔐 Logging in to ${apiUrl}...`);
	const cookies = await login(apiUrl, username, password);
	const imported = await importAll(apiUrl, cookies, puzzles);

	console.log(`\n🎉 Done. ${imported}/${puzzles.length} puzzles imported.`);
}

main().catch((error) => {
	console.error(`\n❌ ${error.message}`);
	process.exit(1);
});
