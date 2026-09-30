import { ChessMove, ChessPosition } from '@app/definition/chess.type';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessNotation } from '@app/util/chess/chess-notation';

export const STOCKFISH_URL = '/stockfish/stockfish-18-lite-single.js';

export type UciLineListener = (line: string) => void;

export interface UciGame {
	readonly start: ChessPosition;
	readonly moves: readonly ChessMove[];
}

export function uciPosition(game: UciGame): string {
	const start = `position fen ${ChessFen.serialize(game.start)}`;

	if (0 === game.moves.length) {
		return start;
	}

	return `${start} moves ${game.moves.map((move) => ChessNotation.describeLong(move)).join(' ')}`;
}

export class UciEngine {
	private worker: Worker | undefined;

	constructor(private readonly url: string) {}

	send(command: string, onLine?: UciLineListener): Promise<string[]> {
		const worker = (this.worker ??= new Worker(this.url));

		if (!expectsAnswer(command)) {
			worker.postMessage(command);

			return Promise.resolve([]);
		}

		return listen(worker, command, onLine);
	}

	terminate(): void {
		this.worker?.terminate();
		this.worker = undefined;
	}
}

function listen(worker: Worker, command: string, onLine?: UciLineListener): Promise<string[]> {
	return new Promise((resolve, reject) => {
		const lines: string[] = [];
		const onMessage = (event: MessageEvent<string>): void => {
			const line = event.data.trim();

			lines.push(line);
			onLine?.(line);

			if (isAnswer(command, line)) {
				detach();
				resolve(lines);
			}
		};
		const onError = (event: ErrorEvent): void => {
			detach();
			reject(event.error instanceof Error ? event.error : new Error(event.message));
		};
		const detach = (): void => {
			worker.removeEventListener('message', onMessage);
			worker.removeEventListener('error', onError);
		};

		worker.addEventListener('message', onMessage);
		worker.addEventListener('error', onError);
		worker.postMessage(command);
	});
}

function expectsAnswer(command: string): boolean {
	return 'uci' === command || 'isready' === command || command.startsWith('go ');
}

function isAnswer(command: string, line: string): boolean {
	if ('uci' === command) {
		return 'uciok' === line;
	}

	if ('isready' === command) {
		return 'readyok' === line;
	}

	return line.startsWith('bestmove ');
}
