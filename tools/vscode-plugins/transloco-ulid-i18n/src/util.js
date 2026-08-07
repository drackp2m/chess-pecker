const { readFileSync } = require('node:fs');

const vscode = require('vscode');

const SELECTOR = [
	{ scheme: 'file', language: 'typescript' },
	{ scheme: 'file', language: 'html' },
];

function locate(file, needle) {
	if (null === file) {
		return null;
	}

	let lines;

	try {
		lines = readFileSync(file, 'utf8').split('\n');
	} catch {
		return null;
	}

	const line = lines.findIndex((content) => content.includes(needle));

	if (-1 === line) {
		return new vscode.Location(vscode.Uri.file(file), new vscode.Position(0, 0));
	}

	const character = lines[line].indexOf(needle);

	return new vscode.Location(vscode.Uri.file(file), new vscode.Position(line, character));
}

const TRANSLOCO_PIPE = /^\s*\|\s*transloco\b/;

function displayRange(document, usage) {
	const [pipe] = TRANSLOCO_PIPE.exec(document.getText().slice(usage.end)) ?? [];

	return new vscode.Range(
		document.positionAt(usage.start),
		document.positionAt(usage.end + (pipe?.length ?? 0)),
	);
}

function shorten(text, max) {
	const flat = String(text).replace(/\s+/g, ' ').trim();

	return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function usageAt(index, document, position) {
	const offset = document.offsetAt(position);

	return (
		index
			.findUsages(document.getText())
			.find((usage) => offset >= usage.start && offset <= usage.end) ?? null
	);
}

function usageRange(document, usage) {
	return new vscode.Range(document.positionAt(usage.start), document.positionAt(usage.end));
}

module.exports = { SELECTOR, displayRange, locate, shorten, usageAt, usageRange };
