import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PuzzleSolverComponent } from '@app/component/puzzle-solver/puzzle-solver.component';
import { DEFAULT_MOVE_ANIMATION } from '@app/definition/board-animation.type';
import { MOVE_INPUT_METHODS_ALL } from '@app/definition/board-input.type';
import { BOARD_PRESENTER } from '@app/definition/board-presenter.interface';
import { DEFAULT_MOVE_SPEED } from '@app/definition/move-speed.type';
import { Puzzle } from '@app/definition/puzzle.type';
import { PuzzleStore } from '@app/page/puzzle/store/puzzle/puzzle.store';
import { PuzzleLibraryStore } from '@app/page/puzzle/store/puzzle-library/puzzle-library.store';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { SoundService } from '@app/service/sound.service';
import { PuzzleImportUseCase } from '@app/use-case/puzzle-import.use-case';

const PUZZLE: Puzzle = {
	id: 'JOGv3',
	fen: '5r2/pp6/2p3k1/2R1p2n/8/1BP5/Pr4PP/5R1K w - - 0 27',
	moves: ['f1f8', 'b2b1', 'b3d1', 'b1d1', 'f8f1', 'd1f1'],
	rating: 536,
	themes: ['backRankMate', 'mateIn3'],
	selectedFor: '500-599 / backRankMate',
};

/**
 * Stands in for whichever page hosts the view: it owns the exercise and the stores,
 * and puts its own controls through the projection slot.
 */
@Component({
	selector: 'app-solver-host',
	imports: [PuzzleSolverComponent],
	template: `<app-puzzle-solver><button class="host-control">Next</button></app-puzzle-solver>`,
	providers: [
		PuzzleLibraryStore,
		PuzzleStore,
		{ provide: BOARD_PRESENTER, useExisting: PuzzleStore },
	],
})
class SolverHostComponent {
	readonly store = inject(PuzzleStore);
}

function createHost() {
	TestBed.configureTestingModule({
		providers: [
			{
				provide: BoardPreferenceService,
				useValue: {
					moveSpeed: signal(DEFAULT_MOVE_SPEED),
					moveAnimation: signal(DEFAULT_MOVE_ANIMATION),
					moveInputMethods: signal(MOVE_INPUT_METHODS_ALL),
				},
			},
			{ provide: SoundService, useValue: { playMove: (): void => undefined } },
			{
				provide: PuzzleImportUseCase,
				useValue: {
					import: (name: string, puzzles: readonly Puzzle[]) =>
						Promise.resolve({ uuid: name, name, puzzles }),
					findLast: () => Promise.resolve(undefined),
				} satisfies Partial<PuzzleImportUseCase>,
			},
		],
	});

	const fixture = TestBed.createComponent(SolverHostComponent);

	fixture.detectChanges();

	const element = fixture.nativeElement as HTMLElement;

	return {
		store: fixture.componentInstance.store,

		element,

		open(): void {
			fixture.componentInstance.store.setPuzzles([PUZZLE]);
			vi.advanceTimersByTime(1500);
			fixture.detectChanges();
		},

		/** Clicks a button by the label it carries, the way the player finds it. */
		click(label: string): void {
			fixture.detectChanges();

			const button = [...element.querySelectorAll('button')].find(
				(candidate) => label === candidate.textContent.trim(),
			);

			button?.click();
			fixture.detectChanges();
		},

		themes(): string[] {
			return [...element.querySelectorAll('.theme')].map((item) => item.textContent);
		},
	};
}

describe('PuzzleSolverComponent', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		TestBed.resetTestingModule();
	});

	it('draws nothing until the host opens an exercise', () => {
		const host = createHost();

		expect(host.element.querySelector('app-chess-board')).toBeNull();
	});

	it('draws the board, the panel and the scoresheet once there is one', () => {
		const host = createHost();

		host.open();

		expect(host.element.querySelector('app-chess-board')).not.toBeNull();
		expect(host.element.querySelector('app-move-history')).not.toBeNull();
		expect(host.element.querySelector('.panel')).not.toBeNull();
	});

	it('keeps the themes covered until the hint is taken', () => {
		const host = createHost();

		host.open();

		expect(host.themes()).toEqual([]);
		expect(host.element.querySelector('.themes')).toBeNull();

		host.click('Hint');

		expect(host.themes()).toEqual(['backRankMate', 'mateIn3']);
		expect(host.store.hintUsed()).toBe(true);
	});

	it('offers the answer only once the exercise has been missed', () => {
		const host = createHost();

		host.open();
		host.click('Give up');

		expect(host.store.closure()).toBe('open');

		// The move to find is Rb1+; Rc2 is legal and is not it.
		host.store.selectSquare('b2');
		host.store.selectSquare('c2');
		host.click('Give up');

		expect(host.store.closure()).toBe('revealed');
	});

	it('shows the host its own controls under the board', () => {
		const host = createHost();

		host.open();

		expect(host.element.querySelector('.host-control')).not.toBeNull();
	});

	it('drives the shared store from the line controls', () => {
		const host = createHost();

		host.open();

		// The opponent's opening move has been replayed, so the line can be rewound.
		expect(host.store.cursor()).toBe(1);

		host.element.querySelector<HTMLButtonElement>('[aria-label="Step back one move"]')?.click();

		expect(host.store.cursor()).toBe(0);

		host.element.querySelector<HTMLButtonElement>('[aria-label="Flip board"]')?.click();

		expect(host.store.orientation()).toBe('white');
	});
});
