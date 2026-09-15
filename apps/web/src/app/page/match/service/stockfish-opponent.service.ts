import { DestroyRef, Injectable, inject } from '@angular/core';

import type { ChessPosition } from '@app/definition/chess.type';
import { ChessFen } from '@app/util/chess/chess-fen';

export const STOCKFISH_ELO_LEVELS = [
	2300, 2400, 2500, 2600, 2700, 2800, 2900, 3000, 3100, 3190,
] as const;
export type StockfishElo = (typeof STOCKFISH_ELO_LEVELS)[number];

const ENGINE_URL = '/stockfish/stockfish-18-lite-single.js';

@Injectable({
	providedIn: 'root',
})
export class StockfishOpponentService {
	private worker: Worker | undefined;

	private ready: Promise<void> | undefined;

	private elo: StockfishElo | undefined;

	constructor() {
		inject(DestroyRef).onDestroy(() => this.worker?.terminate());
	}

	chooseNotation(position: ChessPosition, elo: StockfishElo): Promise<string | undefined> {
		return this.prepare(elo)
			.then(() => this.send(`position fen ${ChessFen.serialize(position)}`))
			.then(() => this.send('go movetime 1000'))
			.then((line) => this.bestMove(line));
	}

	private prepare(elo: StockfishElo): Promise<void> {
		this.ready ??= this.send('uci').then(() => undefined);

		return this.ready.then(() => {
			if (this.elo === elo) {
				return;
			}

			this.elo = elo;

			return this.send(`setoption name UCI_LimitStrength value true`)
				.then(() => this.send(`setoption name UCI_Elo value ${String(elo)}`))
				.then(() => this.send('isready'))
				.then(() => undefined);
		});
	}

	private send(command: string): Promise<string> {
		const worker = (this.worker ??= new Worker(ENGINE_URL));

		return new Promise((resolve, reject) => {
			const onMessage = (event: MessageEvent<string>): void => {
				const line = event.data.trim();

				if ('uci' === command && 'uciok' !== line) {
					return;
				}

				if ('isready' === command && 'readyok' !== line) {
					return;
				}

				if (command.startsWith('go ') && !line.startsWith('bestmove ')) {
					return;
				}

				this.removeListeners(worker, onMessage, onError);
				resolve(line);
			};
			const onError = (event: ErrorEvent): void => {
				this.removeListeners(worker, onMessage, onError);
				reject(event.error instanceof Error ? event.error : new Error(event.message));
			};

			worker.addEventListener('message', onMessage);
			worker.addEventListener('error', onError);
			worker.postMessage(command);

			if (command.startsWith('setoption') || command.startsWith('position')) {
				this.removeListeners(worker, onMessage, onError);
				resolve('');
			}
		});
	}

	private removeListeners(
		worker: Worker,
		onMessage: (event: MessageEvent<string>) => void,
		onError: (event: ErrorEvent) => void,
	): void {
		worker.removeEventListener('message', onMessage);
		worker.removeEventListener('error', onError);
	}

	private bestMove(line: string): string | undefined {
		const move = line.split(' ')[1];

		return undefined === move || '0000' === move ? undefined : move;
	}
}
