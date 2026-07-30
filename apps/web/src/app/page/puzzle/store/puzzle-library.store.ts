import { Injectable, computed } from '@angular/core';
import { patchState, signalStore, withState } from '@ngrx/signals';

import { Puzzle } from '@app/definition/puzzle.type';
import { PuzzleCsv } from '@app/util/puzzle-csv';

interface PuzzleLibraryProps {
	puzzles: readonly Puzzle[];
	index: number;
	importError: string | undefined;
	importNotice: string | undefined;
}

function buildLibraryState(): PuzzleLibraryProps {
	return {
		puzzles: [],
		index: 0,
		importError: undefined,
		importNotice: undefined,
	};
}

/**
 * The loaded set of exercises and the cursor over it. Kept apart from the solving
 * session so the origin of the rows — a pasted CSV today, a database table later —
 * stays a concern of its own.
 */
// ToDo => the split is the right seam, but the set only lives in memory and is
// provided by `PuzzlePage`, so a reload or a navigation loses the whole import.
// Woodpecker works on a *named, fixed* set replayed over several cycles, which needs
// at least: a persisted `puzzleSet` (name, created date, ordered puzzle ids), the
// `puzzle` rows themselves, and a `cycle` (which pass over the set, its order — the
// method usually reshuffles per cycle — and where the user stopped). `index` alone
// cannot express "puzzle 40 of cycle 3, 12 still unsolved this pass".
//
// ToDo => `setPuzzles` leaves `importError` set from an earlier failed import.
@Injectable()
export class PuzzleLibraryStore extends signalStore(
	{ protectedState: false },
	withState(buildLibraryState),
) {
	readonly current = computed(() => this.puzzles()[this.index()]);
	readonly hasPrevious = computed(() => 0 < this.index());
	readonly hasNext = computed(() => this.index() < this.puzzles().length - 1);

	loadCsv(text: string): boolean {
		const { puzzles, skipped } = PuzzleCsv.parse(text);

		if (0 === puzzles.length) {
			patchState(this, {
				importError: 'No readable exercises in that CSV.',
				importNotice: undefined,
			});

			return false;
		}

		this.setPuzzles(puzzles);
		patchState(this, {
			importError: undefined,
			importNotice: this.describeImport(puzzles, skipped),
		});

		return true;
	}

	/** Source-agnostic entry point: feed it rows from a database just as well. */
	setPuzzles(puzzles: readonly Puzzle[]): void {
		patchState(this, { puzzles, index: 0 });
	}

	/** Moves the cursor, reporting whether it actually landed somewhere new. */
	select(index: number): boolean {
		if (0 > index || index >= this.puzzles().length) {
			return false;
		}

		patchState(this, { index });

		return true;
	}

	next(): boolean {
		return this.select(this.index() + 1);
	}

	previous(): boolean {
		return this.select(this.index() - 1);
	}

	private describeImport(puzzles: readonly Puzzle[], skipped: number): string {
		const loaded = `Loaded ${puzzles.length.toString()} exercises`;

		return 0 === skipped
			? `${loaded}.`
			: `${loaded}, skipped ${skipped.toString()} unreadable rows.`;
	}
}
