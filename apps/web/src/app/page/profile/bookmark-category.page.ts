import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { PuzzleBookmarkType } from '@chesspecker/api-definitions';

import { StaticChessBoardComponent } from '@app/component/static-chess-board/static-chess-board.component';
import { PUZZLE_BOOKMARK_LABEL } from '@app/definition/puzzle-bookmark.type';
import { Puzzle } from '@app/definition/puzzle.type';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { I18n, provideI18nScope } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { PuzzleRemoteRepository } from '@app/repository/puzzle-remote.repository';
import { BookmarkStore } from '@app/store/bookmark.store';
import { PuzzleMapper } from '@app/util/puzzle-mapper';

@Component({
	templateUrl: './bookmark-category.page.html',
	styleUrl: './bookmark-category.page.scss',
	imports: [StaticChessBoardComponent, RouterLinkDirective, I18nPipe],
	providers: [provideI18nScope('puzzle')],
})
export class BookmarkCategoryPage implements OnInit {
	protected readonly I18n = I18n;

	readonly puzzles = signal<readonly Puzzle[]>([]);
	readonly isLoading = signal(true);
	readonly loadError = signal(false);

	private readonly bookmarks = inject(BookmarkStore);
	private readonly puzzleRepository = inject(PuzzleRemoteRepository);
	private readonly route = inject(ActivatedRoute);
	private readonly type = this.route.snapshot.paramMap.get('type') ?? '';

	readonly categoryLabel = PUZZLE_BOOKMARK_LABEL[this.type as PuzzleBookmarkType];

	solveLink(id: string): string {
		return `/profile/bookmarks/${this.type}/solve/${id}`;
	}

	ngOnInit(): void {
		void this.load();
	}

	private async load(): Promise<void> {
		try {
			await this.bookmarks.ready();
			const ids = this.bookmarks
				.bookmarkEntities()
				.filter((bookmark) => bookmark.type === this.type)
				.map((bookmark) => bookmark.lichessId);
			const loaded = await Promise.all(ids.map((id) => this.puzzleRepository.getOne(id)));

			this.puzzles.set(loaded.map(({ uuid: _uuid, ...puzzle }) => PuzzleMapper.toPuzzle(puzzle)));
		} catch {
			this.loadError.set(true);
		} finally {
			this.isLoading.set(false);
		}
	}
}
