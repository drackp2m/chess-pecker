import { Component, inject, input, output } from '@angular/core';

import { ChessBoardComponent } from '@app/component/chess-board/chess-board.component';
import { MoveHistoryComponent } from '@app/component/move-history/move-history.component';
import { ButtonDirective } from '@app/directive/button.directive';
import { I18n } from '@app/i18n';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { I18nPipe } from '@app/pipe/i18n.pipe';

/**
 * The solving view itself: the board, the line controls, free play, the themes panel
 * and the scoresheet. Whoever hosts it owns the exercise around it — the library on
 * `/puzzle`, the run on `/training` — and steps through it with the two arrows pinned
 * to the ends of the control row, which are theirs to label, gate and answer.
 */
@Component({
	selector: 'app-puzzle-solver',
	templateUrl: './puzzle-solver.component.html',
	styleUrl: './puzzle-solver.component.scss',
	imports: [ChessBoardComponent, MoveHistoryComponent, ButtonDirective, I18nPipe],
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
