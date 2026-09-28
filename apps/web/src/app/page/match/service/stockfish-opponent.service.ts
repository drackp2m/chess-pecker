import { DestroyRef, Injectable, inject } from '@angular/core';

import type { ChessPosition } from '@app/definition/chess.type';
import {
	NATIVE_ELO_FLOOR,
	humanizedProfile,
	pickHumanizedMove,
	readCandidates,
} from '@app/page/match/service/stockfish-humanizer';
import { ChessFen } from '@app/util/chess/chess-fen';

export const STOCKFISH_ELO_LEVELS = [
	500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100,
	2200, 2300, 2400, 2500, 2600, 2700, 2800, 2900, 3000, 3100, 3190,
] as const;
export type StockfishElo = (typeof STOCKFISH_ELO_LEVELS)[number];

const ENGINE_URL = '/stockfish/stockfish-18-lite-single.js';

@Injectable({
	providedIn: 'root',
})
export class StockfishOpponentService {
	private worker: Worker | undefined;

	private ready: Promise<void> | undefined;

	private setup: string | undefined;

	constructor() {
		inject(DestroyRef).onDestroy(() => this.worker?.terminate());
	}

	chooseNotation(position: ChessPosition, elo: StockfishElo): Promise<string | undefined> {
		return elo < NATIVE_ELO_FLOOR
			? this.chooseHumanized(position, elo)
			: this.chooseNative(position, elo);
	}

	private chooseNative(position: ChessPosition, elo: StockfishElo): Promise<string | undefined> {
		return this.configure(`native:${String(elo)}`, [
			'setoption name MultiPV value 1',
			'setoption name UCI_LimitStrength value true',
			`setoption name UCI_Elo value ${String(elo)}`,
		])
			.then(() => this.search(position, 'go movetime 1000'))
			.then((lines) => this.bestMove(lines));
	}

	private chooseHumanized(position: ChessPosition, elo: StockfishElo): Promise<string | undefined> {
		const profile = humanizedProfile(elo);

		return this.configure(`humanized:${String(elo)}`, [
			'setoption name UCI_LimitStrength value false',
			`setoption name MultiPV value ${String(profile.candidates)}`,
		])
			.then(() => this.search(position, `go depth ${String(profile.depth)}`))
			.then((lines) => pickHumanizedMove(position, readCandidates(lines), profile));
	}

	private configure(setup: string, commands: readonly string[]): Promise<void> {
		this.ready ??= this.send('uci').then(() => undefined);

		return this.ready.then(() => {
			if (this.setup === setup) {
				return;
			}

			this.setup = setup;

			return commands
				.reduce<Promise<unknown>>(
					(chain, command) => chain.then(() => this.send(command)),
					Promise.resolve(),
				)
				.then(() => this.send('isready'))
				.then(() => undefined);
		});
	}

	private search(position: ChessPosition, command: string): Promise<string[]> {
		return this.send(`position fen ${ChessFen.serialize(position)}`).then(() => this.send(command));
	}

	private send(command: string): Promise<string[]> {
		const worker = (this.worker ??= new Worker(ENGINE_URL));

		return new Promise((resolve, reject) => {
			const lines: string[] = [];
			const onMessage = (event: MessageEvent<string>): void => {
				const line = event.data.trim();

				lines.push(line);

				if (!this.isAnswer(command, line)) {
					return;
				}

				this.removeListeners(worker, onMessage, onError);
				resolve(lines);
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
				resolve([]);
			}
		});
	}

	private isAnswer(command: string, line: string): boolean {
		if ('uci' === command) {
			return 'uciok' === line;
		}

		if ('isready' === command) {
			return 'readyok' === line;
		}

		return !command.startsWith('go ') || line.startsWith('bestmove ');
	}

	private removeListeners(
		worker: Worker,
		onMessage: (event: MessageEvent<string>) => void,
		onError: (event: ErrorEvent) => void,
	): void {
		worker.removeEventListener('message', onMessage);
		worker.removeEventListener('error', onError);
	}

	private bestMove(lines: readonly string[]): string | undefined {
		const move = lines.at(-1)?.split(' ')[1];

		return undefined === move || '0000' === move || '(none)' === move ? undefined : move;
	}
}
