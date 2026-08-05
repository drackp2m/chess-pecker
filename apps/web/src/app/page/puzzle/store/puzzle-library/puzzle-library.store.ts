import { Injectable, computed, inject } from '@angular/core';
import { patchState, signalStore, withState } from '@ngrx/signals';

import { Puzzle } from '@app/definition/puzzle.type';
import { PuzzleImportUseCase } from '@app/use-case/puzzle-import.use-case';
import { PuzzleCsv } from '@app/util/puzzle-csv';

interface PuzzleLibraryProps {
	puzzles: readonly Puzzle[];
	index: number;
	setUuid: string | undefined;
	setName: string | undefined;
	importError: string | undefined;
	importNotice: string | undefined;
}

function buildLibraryState(): PuzzleLibraryProps {
	return {
		puzzles: [],
		index: 0,
		setUuid: undefined,
		setName: undefined,
		importError: undefined,
		importNotice: undefined,
	};
}

/**
 * The loaded set of exercises and the cursor over it. Kept apart from the solving
 * session so the origin of the rows — a pasted CSV today, a database table later —
 * stays a concern of its own.
 */
// ToDo => a set is persisted, but a *cycle* is not: which pass over the set it is, its
// order — the method usually reshuffles per cycle — and where the user stopped. `index`
// alone cannot express "puzzle 40 of cycle 3, 12 still unsolved this pass".
@Injectable()
export class PuzzleLibraryStore extends signalStore(
	{ protectedState: false },
	withState(buildLibraryState),
) {
	private readonly imports = inject(PuzzleImportUseCase);

	readonly current = computed(() => this.puzzles()[this.index()]);
	readonly hasPrevious = computed(() => 0 < this.index());
	readonly hasNext = computed(() => this.index() < this.puzzles().length - 1);

	loadCsv(text: string, name: string): boolean {
		const { puzzles, skipped } = PuzzleCsv.parse(text);

		if (0 === puzzles.length) {
			this.failImport('No readable exercises in that CSV.');

			return false;
		}

		this.setPuzzles(puzzles);
		patchState(this, { importNotice: this.describeImport(puzzles, skipped) });
		void this.persist(name, puzzles);

		return true;
	}

	/**
	 * Reopens the last imported set. A missing or unreadable database is not an error
	 * here: the page simply comes up asking for an import, which is its empty state.
	 */
	async restore(): Promise<readonly Puzzle[]> {
		const stored = await this.imports.findLast().catch(() => undefined);

		if (undefined === stored || 0 === stored.puzzles.length) {
			return [];
		}

		this.setPuzzles(stored.puzzles);
		patchState(this, { setUuid: stored.uuid, setName: stored.name });

		return stored.puzzles;
	}

	/**
	 * Reports an import that never got as far as CSV text — an unreadable file, say —
	 * through the same channel the caller already watches.
	 */
	failImport(message: string): void {
		patchState(this, { importError: message, importNotice: undefined });
	}

	/** Source-agnostic entry point: feed it rows from a database just as well. */
	setPuzzles(puzzles: readonly Puzzle[]): void {
		patchState(this, { puzzles, index: 0, importError: undefined });
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

	/**
	 * The board is already playing by the time this runs, so a failed write only costs
	 * the set on the next reload — it is reported, never thrown back at the solver.
	 */
	private async persist(name: string, puzzles: readonly Puzzle[]): Promise<void> {
		try {
			const stored = await this.imports.import(name, puzzles);

			patchState(this, { setUuid: stored.uuid, setName: stored.name });
		} catch {
			patchState(this, { importError: 'Imported, but the set could not be saved for next time.' });
		}
	}

	private describeImport(puzzles: readonly Puzzle[], skipped: number): string {
		const loaded = `Loaded ${puzzles.length.toString()} exercises`;

		return 0 === skipped
			? `${loaded}.`
			: `${loaded}, skipped ${skipped.toString()} unreadable rows.`;
	}
}
