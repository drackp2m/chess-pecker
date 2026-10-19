import { DestroyRef, Injectable, inject } from '@angular/core';

import type { ChessPosition } from '@app/definition/chess.type';
import {
	NATIVE_ELO_FLOOR,
	humanizedProfile,
	pickHumanizedMove,
	readCandidates,
} from '@app/page/match/service/stockfish-humanizer';
import { STOCKFISH_URL, UciEngine, UciGame, uciPosition } from '@app/page/match/service/uci-engine';

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

	private isNewGame = true;

	private isSearching = false;

	private latest = 0;

	private queue: Promise<unknown> = Promise.resolve();

	constructor() {
		inject(DestroyRef).onDestroy(() => {
			this.engine.terminate();
		});
	}

	newGame(): void {
		this.latest += 1;
		this.isNewGame = true;
		this.interrupt();
	}

	chooseNotation(
		game: UciGame,
		position: ChessPosition,
		elo: StockfishElo,
	): Promise<string | undefined> {
		const ticket = ++this.latest;

		this.interrupt();

		const answer = this.queue.then(() =>
			this.isCurrent(ticket) ? this.choose(ticket, game, position, elo) : undefined,
		);

		this.queue = answer.catch(() => undefined);

		return answer;
	}

	private async choose(
		ticket: number,
		game: UciGame,
		position: ChessPosition,
		elo: StockfishElo,
	): Promise<string | undefined> {
		try {
			return elo < NATIVE_ELO_FLOOR
				? await this.chooseHumanized(ticket, game, position, elo)
				: await this.chooseNative(ticket, game, elo);
		} catch (error: unknown) {
			this.discardEngine();

			throw error;
		}
	}

	private async chooseNative(
		ticket: number,
		game: UciGame,
		elo: StockfishElo,
	): Promise<string | undefined> {
		await this.configure(`native:${String(elo)}`, [
			'setoption name MultiPV value 1',
			'setoption name UCI_LimitStrength value true',
			`setoption name UCI_Elo value ${String(elo)}`,
		]);

		const lines = await this.search(ticket, game, 'go movetime 1000');

		return this.isCurrent(ticket) ? bestMove(lines) : undefined;
	}

	private async chooseHumanized(
		ticket: number,
		game: UciGame,
		position: ChessPosition,
		elo: StockfishElo,
	): Promise<string | undefined> {
		const profile = humanizedProfile(elo);

		await this.configure(`humanized:${String(elo)}`, [
			'setoption name UCI_LimitStrength value false',
			`setoption name MultiPV value ${String(profile.candidates)}`,
		]);

		const lines = await this.search(ticket, game, `go depth ${String(profile.depth)}`);

		return this.isCurrent(ticket)
			? pickHumanizedMove(position, readCandidates(lines), profile)
			: undefined;
	}

	private async configure(setup: string, commands: readonly string[]): Promise<void> {
		this.ready ??= this.engine.send('uci').then(() => undefined);
		await this.ready;

		const pending = [
			...(this.setup === setup ? [] : commands),
			...(this.isNewGame ? ['ucinewgame'] : []),
		];

		this.setup = setup;
		this.isNewGame = false;

		if (0 === pending.length) {
			return;
		}

		for (const command of pending) {
			await this.engine.send(command);
		}

		await this.engine.send('isready');
	}

	private async search(ticket: number, game: UciGame, command: string): Promise<string[]> {
		await this.engine.send(uciPosition(game));

		if (!this.isCurrent(ticket)) {
			return [];
		}

		this.isSearching = true;

		try {
			return await this.engine.send(command);
		} finally {
			this.isSearching = false;
		}
	}

	private interrupt(): void {
		if (this.isSearching) {
			void this.engine.send('stop');
		}
	}

	private isCurrent(ticket: number): boolean {
		return ticket === this.latest;
	}

	private discardEngine(): void {
		this.engine.terminate();
		this.ready = undefined;
		this.setup = undefined;
		this.isNewGame = true;
		this.isSearching = false;
	}
}

function bestMove(lines: readonly string[]): string | undefined {
	const move = lines.at(-1)?.split(' ')[1];

	return undefined === move || '0000' === move || '(none)' === move ? undefined : move;
}
