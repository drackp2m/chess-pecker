import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const DEFAULT_API_URL = 'https://chesspecker-api.onrender.com/api';
const DEFAULT_CSV_PATH = 'ideas/puzzles/selected_puzzles.csv';
const BATCH_SIZE = 2000;

function prompt(question) {
	const rl = createInterface({ input: process.stdin, output: process.stdout });

	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer);
		});
	});
}

function promptHidden(question) {
	return new Promise((resolve) => {
		const { stdin } = process;

		process.stdout.write(question);
		stdin.setRawMode(true);
		stdin.resume();
		stdin.setEncoding('utf8');

		let input = '';

		const onData = (char) => {
			if ('\n' === char || '\r' === char || '\u0004' === char) {
				stdin.setRawMode(false);
				stdin.pause();
				stdin.removeListener('data', onData);
				process.stdout.write('\n');
				resolve(input);

				return;
			}

			if ('\u0003' === char) {
				process.stdout.write('\n');
				process.exit(1);
			}

			if ('\u007f' === char || '\b' === char) {
				input = input.slice(0, -1);

				return;
			}

			input += char;
		};

		stdin.on('data', onData);
	});
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

async function main() {
	const apiUrl = process.env.API_URL ?? DEFAULT_API_URL;
	const csvPath = process.argv[2] ?? DEFAULT_CSV_PATH;

	console.log(`📄 Reading ${csvPath}...`);
	const content = readFileSync(join(process.cwd(), csvPath), 'utf8');
	const puzzles = parseCsv(content);

	console.log(`🧩 Parsed ${puzzles.length} puzzles.`);

	const username = await prompt('Admin username: ');
	const password = await promptHidden('Admin password: ');

	console.log(`🔐 Logging in to ${apiUrl}...`);
	const cookies = await login(apiUrl, username, password);

	const batches = chunk(puzzles, BATCH_SIZE);
	let imported = 0;

	for (const [index, batch] of batches.entries()) {
		console.log(`⬆️  Importing batch ${index + 1}/${batches.length} (${batch.length} puzzles)...`);

		const result = await importBatch(apiUrl, cookies, batch);

		imported += result.imported;
		console.log(`   ✅ ${result.imported} upserted.`);
	}

	console.log(`\n🎉 Done. ${imported}/${puzzles.length} puzzles imported.`);
}

main().catch((error) => {
	console.error(`\n❌ ${error.message}`);
	process.exit(1);
});
