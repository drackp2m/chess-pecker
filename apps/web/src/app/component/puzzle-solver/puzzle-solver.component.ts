import { Component, inject, input, output } from '@angular/core';

import { ChessBoardComponent } from '@app/component/chess-board/chess-board.component';
import { MoveHistoryComponent } from '@app/component/move-history/move-history.component';
import { ButtonDirective } from '@app/directive/button.directive';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';

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
	imports: [ChessBoardComponent, MoveHistoryComponent, ButtonDirective],
})
export class PuzzleSolverComponent {
	readonly store = inject(PuzzleStore);

	readonly previousLabel = input('Previous');
	readonly nextLabel = input('Next');
	readonly isPreviousDisabled = input(false);
	readonly isNextDisabled = input(false);

	readonly previous = output();
	readonly next = output();
}
