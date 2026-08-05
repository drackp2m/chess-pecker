import { Component, inject } from '@angular/core';

import { ChessBoardComponent } from '@app/component/chess-board/chess-board.component';
import { MoveHistoryComponent } from '@app/component/move-history/move-history.component';
import { ButtonDirective } from '@app/directive/button.directive';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';

/**
 * The solving view itself: the board, the line controls, free play, the themes panel
 * and the scoresheet. Whoever hosts it owns the exercise around it — the library and
 * its importer on `/puzzle`, the run and its "Next" on `/training` — and hands those
 * in through the projection slot under the board.
 */
@Component({
	selector: 'app-puzzle-solver',
	templateUrl: './puzzle-solver.component.html',
	styleUrl: './puzzle-solver.component.scss',
	imports: [ChessBoardComponent, MoveHistoryComponent, ButtonDirective],
})
export class PuzzleSolverComponent {
	readonly store = inject(PuzzleStore);
}
