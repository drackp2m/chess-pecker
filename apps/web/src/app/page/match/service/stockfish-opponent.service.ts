import { DestroyRef, Injectable, inject } from '@angular/core';

import type { ChessPosition } from '@app/definition/chess.type';
import {
	NATIVE_ELO_FLOOR,
	humanizedProfile,
	pickHumanizedMove,
	readCandidates,
} from '@app/page/match/service/stockfish-humanizer';
import { STOCKFISH_URL, UciEngine } from '@app/page/match/service/uci-engine';
import { ChessFen } from '@app/util/chess/chess-fen';

export const STOCKFISH_ELO_LEVELS = [
	500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100,
	2200, 2300, 2400, 2500, 2600, 2700, 2800, 2900, 3000, 3100, 3190,
] as const;
export type StockfishElo = (typeof STOCKFISH_ELO_LEVELS)[number];

@Injectable({
	providedIn: 'root',
})
export class StockfishOpponentService {
	private readonly engine = new UciEngine(STOCKFISH_URL);

	private ready: Promise<void> | undefined;

	private setup: string | undefined;

	constructor() {
		inject(DestroyRef).onDestroy(() => {
			this.engine.terminate();
		});
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
		this.ready ??= this.engine.send('uci').then(() => undefined);

		return this.ready.then(() => {
			if (this.setup === setup) {
				return;
			}

			this.setup = setup;

			return commands
				.reduce<Promise<unknown>>(
					(chain, command) => chain.then(() => this.engine.send(command)),
					Promise.resolve(),
				)
				.then(() => this.engine.send('isready'))
				.then(() => undefined);
		});
	}

	private search(position: ChessPosition, command: string): Promise<string[]> {
		return this.engine
			.send(`position fen ${ChessFen.serialize(position)}`)
			.then(() => this.engine.send(command));
	}

	private bestMove(lines: readonly string[]): string | undefined {
		const move = lines.at(-1)?.split(' ')[1];

		return undefined === move || '0000' === move || '(none)' === move ? undefined : move;
	}
}
