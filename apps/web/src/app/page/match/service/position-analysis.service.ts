import { DestroyRef, Injectable, inject, signal } from '@angular/core';

import { ChessPosition } from '@app/definition/chess.type';
import { EngineEvaluation, readEvaluation } from '@app/page/match/service/engine-evaluation';
import { STOCKFISH_URL, UciEngine } from '@app/page/match/service/uci-engine';
import { ChessFen } from '@app/util/chess/chess-fen';

interface AnalysisRequest {
	readonly position: ChessPosition;
	readonly fen: string;
	readonly depth: number;
	readonly key: string;
}

interface AnalysisWaiter {
	readonly fen: string;
	readonly resolve: () => void;
}

@Injectable()
export class PositionAnalysisService {
	private readonly engine = new UciEngine(STOCKFISH_URL);

	private readonly results = new Map<string, EngineEvaluation>();

	private readonly waiters = new Set<AnalysisWaiter>();

	private readonly latest = signal<EngineEvaluation | undefined>(undefined);

	private ready: Promise<unknown> | undefined;

	private queued: AnalysisRequest | undefined;

	private current: AnalysisRequest | undefined;

	private wanted: string | undefined;

	private wasStopped = false;

	readonly evaluation = this.latest.asReadonly();

	constructor() {
		inject(DestroyRef).onDestroy(() => {
			this.halt();
			this.engine.terminate();
		});
	}

	analyse(position: ChessPosition, depth: number): void {
		const fen = ChessFen.serialize(position);
		const request: AnalysisRequest = { position, fen, depth, key: `${String(depth)} ${fen}` };

		if (request.key === this.wanted) {
			return;
		}

		this.wanted = request.key;

		const known = this.results.get(request.key);

		if (undefined !== known) {
			this.latest.set(known);
		}

		this.interrupt(undefined === known ? request : undefined);
	}

	halt(): void {
		this.wanted = undefined;
		this.interrupt(undefined);
	}

	whenSettled(position: ChessPosition): Promise<void> | undefined {
		const fen = ChessFen.serialize(position);

		if (!this.isPending(fen)) {
			return undefined;
		}

		return new Promise((resolve) => {
			this.waiters.add({ fen, resolve });
		});
	}

	private isPending(fen: string): boolean {
		const current = this.current;

		return fen === this.queued?.fen || (fen === current?.fen && current.key === this.wanted);
	}

	private release(): void {
		for (const waiter of this.waiters) {
			if (!this.isPending(waiter.fen)) {
				this.waiters.delete(waiter);
				waiter.resolve();
			}
		}
	}

	private interrupt(next: AnalysisRequest | undefined): void {
		this.queued = next;

		if (undefined !== this.current) {
			this.wasStopped = true;
			void this.engine.send('stop');
		} else if (undefined !== next) {
			void this.drain();
		}

		this.release();
	}

	private async drain(): Promise<void> {
		try {
			for (let next = this.take(); undefined !== next; next = this.take()) {
				await this.search(next);
			}
		} catch {
			this.ready = undefined;
			this.wanted = undefined;
			this.queued = undefined;
			this.current = undefined;
			this.engine.terminate();
			this.release();
		}
	}

	private take(): AnalysisRequest | undefined {
		this.current = this.queued;
		this.queued = undefined;
		this.release();

		return this.current;
	}

	private async search(request: AnalysisRequest): Promise<void> {
		this.ready ??= this.engine.send('uci').then(() => this.engine.send('isready'));
		await this.ready;

		if (request.key !== this.wanted) {
			return;
		}

		this.wasStopped = false;
		await this.engine.send(`position fen ${request.fen}`);

		const lines = await this.engine.send(`go depth ${String(request.depth)}`, (info) => {
			this.publish(request, info);
		});
		const deepest = lines.reduce<EngineEvaluation | undefined>(
			(found, info) => readEvaluation(request.position, request.fen, info) ?? found,
			undefined,
		);

		if (undefined !== deepest) {
			this.results.set(request.key, deepest);
		}
	}

	private publish(request: AnalysisRequest, info: string): void {
		const evaluation = readEvaluation(request.position, request.fen, info);

		if (undefined !== evaluation && request.key === this.wanted) {
			this.latest.set(evaluation);
		}
	}
}
