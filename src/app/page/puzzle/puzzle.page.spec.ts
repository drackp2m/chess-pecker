import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PuzzlePage } from '@app/page/puzzle/puzzle.page';

function createPage(data: Record<string, unknown>): PuzzlePage {
	TestBed.configureTestingModule({
		imports: [PuzzlePage],
		providers: [{ provide: ActivatedRoute, useValue: { snapshot: { data } } }],
	});

	return TestBed.createComponent(PuzzlePage).componentInstance;
}

describe('PuzzlePage', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		TestBed.resetTestingModule();
	});

	it('waits for an import on the plain route', () => {
		const page = createPage({});

		expect(page.store.library.puzzles()).toHaveLength(0);
		expect(page.store.outcome()).toBe('idle');
	});

	it('opens the bundled example ready to play on the sample route', () => {
		const page = createPage({ sample: true });

		vi.advanceTimersByTime(500);

		expect(page.store.library.puzzles()).toHaveLength(1);
		expect(page.store.puzzle()?.id).toBe('JOGv3');

		// The opponent's scripted move has been replayed, so it is the player's turn.
		expect(page.store.history()[0]?.san).toBe('Rxf8');
		expect(page.store.playerColor()).toBe('black');
		expect(page.store.isPlayerTurn()).toBe(true);
		expect(page.headline()).toBe('Find the move for black');

		// And the first solving move is accepted.
		page.store.selectSquare('b2');
		page.store.selectSquare('b1');

		expect(page.store.history()[1]?.san).toBe('Rb1+');
	});
});
