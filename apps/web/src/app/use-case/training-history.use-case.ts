import { Injectable, inject } from '@angular/core';
import type { PuzzleAttemptKind } from '@chesspecker/api-definitions';

import { Puzzle } from '@app/definition/puzzle.type';
import { AttemptRepository } from '@app/repository/attempt.repository';
import { AttemptRow } from '@app/repository/definition/attempt-schema.interface';
import { PuzzleRepository } from '@app/repository/puzzle.repository';
import { TrainingLocalRepository } from '@app/repository/training-local.repository';
import { LocalCycleUseCase } from '@app/use-case/local-cycle.use-case';
import { PuzzleMapper } from '@app/util/puzzle-mapper';

export interface SolvedAttempt {
	readonly row: AttemptRow;
	readonly puzzle: Puzzle;
	/** 1-indexed place of the exercise inside its round or its pass, when it is known. */
	readonly position: number | null;
	readonly total: number | null;
}

export interface TrainingHistoryScope {
	readonly trainingUuid: string;
	readonly kind: PuzzleAttemptKind;
	readonly roundUuid?: string;
}

interface HistoryPlacement {
	readonly total: number;
	readonly keeps: (row: AttemptRow) => boolean;
	readonly place: (row: AttemptRow) => number | null;
}

@Injectable({
	providedIn: 'root',
})
export class TrainingHistoryUseCase {
	private readonly attempts = inject(AttemptRepository);
	private readonly puzzles = inject(PuzzleRepository);
	private readonly local = inject(TrainingLocalRepository);
	private readonly cycles = inject(LocalCycleUseCase);

	async list(scope: TrainingHistoryScope): Promise<readonly SolvedAttempt[]> {
		const placement = await this.resolvePlacement(scope);

		if (undefined === placement) {
			return [];
		}

		const rows = await this.attempts.findAllByIndex('attempt', 'trainingUuid', scope.trainingUuid);
		const finished = rows
			.filter((row) => scope.kind === row.kind)
			.filter((row) => placement.keeps(row))
			.sort((left, right) => left.updatedAt.getTime() - right.updatedAt.getTime());

		const entries = await Promise.all(finished.map((row) => this.toEntry(row, placement)));

		return entries.filter((entry): entry is SolvedAttempt => undefined !== entry);
	}

	private async resolvePlacement(
		scope: TrainingHistoryScope,
	): Promise<HistoryPlacement | undefined> {
		return 'calibration' === scope.kind
			? this.roundPlacement(scope.roundUuid)
			: this.cyclePlacement(scope.trainingUuid);
	}

	private async roundPlacement(
		roundUuid: string | undefined,
	): Promise<HistoryPlacement | undefined> {
		if (undefined === roundUuid) {
			return undefined;
		}

		const dealt = await this.local.findAllByIndex('calibrationPuzzle', 'roundUuid', roundUuid);
		const positions = new Map(dealt.map((row) => [row.lichessId, row.position]));

		return {
			total: dealt.length,
			keeps: (row) => roundUuid === row.roundUuid,
			place: (row) => toPlace(positions.get(row.lichessId)) ?? toPlace(row.position),
		};
	}

	private async cyclePlacement(trainingUuid: string): Promise<HistoryPlacement | undefined> {
		const cycles = await this.cycles.listCycles(trainingUuid);
		const pass = cycles.find((cycle) => 'running' === cycle.status) ?? cycles.at(-1);

		if (undefined === pass) {
			return undefined;
		}

		const items = await this.cycles.listItems(pass.uuid);
		const positions = new Map(items.map((item) => [item.uuid, item.position]));
		const whole = undefined !== pass.expectedItems && items.length === pass.expectedItems;
		const opened = pass.createdAt.getTime();
		const placeOwn = (row: AttemptRow): number | null =>
			toPlace(undefined === row.cycleItemUuid ? undefined : positions.get(row.cycleItemUuid));

		return {
			total: items.length,
			// Un intento es de la pasada si su hueco está entre los suyos. El criterio por fecha
			// —y su respaldo a `row.position`— sólo vale para la pasada que no está entera aquí.
			keeps: (row) => null !== placeOwn(row) || (!whole && opened <= row.updatedAt.getTime()),
			place: (row) => placeOwn(row) ?? (whole ? null : toPlace(row.position)),
		};
	}

	private async toEntry(
		row: AttemptRow,
		placement: HistoryPlacement,
	): Promise<SolvedAttempt | undefined> {
		const stored = await this.puzzles.find('puzzle', row.lichessId).catch(() => undefined);

		return undefined === stored
			? undefined
			: {
					row,
					puzzle: PuzzleMapper.toPuzzle(stored),
					position: placement.place(row),
					total: placement.total,
				};
	}
}

const toPlace = (position: number | undefined): number | null =>
	undefined === position ? null : position + 1;
