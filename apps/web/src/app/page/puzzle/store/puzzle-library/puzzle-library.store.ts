import { Injectable, computed, inject } from '@angular/core';
import { patchState, signalStore, withState } from '@ngrx/signals';

import type { TranslationRef } from '@app/definition/i18n.type';
import { Puzzle } from '@app/definition/puzzle.type';
import { I18n, i18nRef } from '@app/i18n';
import { PuzzleImportUseCase } from '@app/use-case/puzzle-import.use-case';
import { PuzzleCsv } from '@app/util/puzzle-csv';

interface PuzzleLibraryProps {
	puzzles: readonly Puzzle[];
	index: number;
	setUuid: string | undefined;
	setName: string | undefined;
	importError: TranslationRef | undefined;
	importNotice: TranslationRef | undefined;
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
 * The loaded set and the cursor over it, kept apart from the solving session so where the
 * rows came from stays a concern of its own.
 */
// ToDo => a set is persisted but a *cycle* is not: `index` alone cannot express "puzzle 40
// of cycle 3, 12 still unsolved this pass".
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
			this.failImport(i18nRef(I18n.puzzle.NO_READABLE_ROWS));

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
	failImport(message: TranslationRef): void {
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
			patchState(this, { importError: i18nRef(I18n.puzzle.IMPORT_NOT_SAVED) });
		}
	}

	private describeImport(puzzles: readonly Puzzle[], skipped: number): TranslationRef {
		const loaded = puzzles.length;

		return 0 === skipped
			? i18nRef(I18n.puzzle.IMPORTED, { loaded })
			: i18nRef(I18n.puzzle.IMPORTED_WITH_SKIPPED, { loaded, skipped });
	}
}
