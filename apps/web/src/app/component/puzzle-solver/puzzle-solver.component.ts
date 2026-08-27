import { Component, inject, input, output } from '@angular/core';

import { BookmarkButtonComponent } from '@app/component/bookmark-button/bookmark-button.component';
import { ChessBoardComponent } from '@app/component/chess-board/chess-board.component';
import { MoveHistoryComponent } from '@app/component/move-history/move-history.component';
import { ButtonDirective } from '@app/directive/button.directive';
import { I18n } from '@app/i18n';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { I18nPipe } from '@app/pipe/i18n.pipe';

/**
 * The solving view: board, line controls, free play, themes and scoresheet. Whoever hosts it
 * owns the exercise around it, and the two arrows at the ends of the row are theirs.
 */
@Component({
	selector: 'app-puzzle-solver',
	templateUrl: './puzzle-solver.component.html',
	styleUrl: './puzzle-solver.component.scss',
	imports: [
		ChessBoardComponent,
		MoveHistoryComponent,
		BookmarkButtonComponent,
		ButtonDirective,
		I18nPipe,
	],
})
export class PuzzleSolverComponent {
	protected readonly I18n = I18n;

	readonly store = inject(PuzzleStore);

	readonly previousLabel = input<string>(I18n.common.PREVIOUS);
	readonly nextLabel = input<string>(I18n.common.NEXT);
	readonly isPreviousDisabled = input(false);
	readonly isNextDisabled = input(false);

	readonly previous = output();
	readonly next = output();
}
