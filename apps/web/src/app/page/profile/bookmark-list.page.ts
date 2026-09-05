import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { PuzzleDifficultyComponent } from '@app/component/puzzle-difficulty/puzzle-difficulty.component';
import { PuzzleSolverComponent } from '@app/component/puzzle-solver/puzzle-solver.component';
import { BOARD_PRESENTER } from '@app/definition/board-presenter.interface';
import { Puzzle } from '@app/definition/puzzle.type';
import { I18n, provideI18nScope } from '@app/i18n';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library/puzzle-library.store';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { PuzzleRemoteRepository } from '@app/repository/puzzle-remote.repository';
import { BookmarkStore } from '@app/store/bookmark.store';
import { PuzzleMapper } from '@app/util/puzzle-mapper';

@Component({
	templateUrl: './bookmark-list.page.html',
	styleUrl: './bookmark-list.page.scss',
	imports: [PuzzleDifficultyComponent, PuzzleSolverComponent, I18nPipe],
	providers: [
		provideI18nScope('puzzle'),
		PuzzleLibraryStore,
		PuzzleStore,
		{ provide: BOARD_PRESENTER, useExisting: PuzzleStore },
	],
})
export class BookmarkListPage implements OnInit {
	protected readonly I18n = I18n;

	readonly store = inject(PuzzleStore);
	readonly isLoading = signal(true);
	readonly loadError = signal(false);
	readonly counter = computed(() => {
		const total = this.store.library.puzzles().length;

		return 0 === total
			? ''
			: `${(this.store.library.index() + 1).toString()} / ${total.toString()}`;
	});

	private readonly route = inject(ActivatedRoute);
	private readonly bookmarks = inject(BookmarkStore);
	private readonly puzzles = inject(PuzzleRemoteRepository);

	ngOnInit(): void {
		void this.load();
	}

	private async load(): Promise<void> {
		const type = this.route.snapshot.paramMap.get('type');

		try {
			await this.bookmarks.ready();

			const ids = this.bookmarks
				.bookmarkEntities()
				.filter((bookmark) => bookmark.type === type)
				.map((bookmark) => bookmark.lichessId);
			const loaded = await Promise.all(ids.map((id) => this.puzzles.getOne(id)));
			const exercises: Puzzle[] = loaded.map(({ uuid: _uuid, ...puzzle }) =>
				PuzzleMapper.toPuzzle(puzzle),
			);

			this.store.setPuzzles(exercises);
			const selected = this.route.snapshot.paramMap.get('id');
			const index = exercises.findIndex((puzzle) => puzzle.id === selected);

			if (0 <= index) {
				this.store.selectPuzzle(index);
			}
		} catch {
			this.loadError.set(true);
		} finally {
			this.isLoading.set(false);
		}
	}
}
