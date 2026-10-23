import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChessBoard } from '@app/util/chess/chess-board';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessMoveGenerator } from '@app/util/chess/chess-move-generator';

describe('ChessMoveGenerator.status', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('tells a game is still on from the first legal move it finds', () => {
		const position = ChessFen.initial();
		const apply = vi.spyOn(ChessBoard, 'apply');

		expect(ChessMoveGenerator.status(position, [])).toBe('playing');
		expect(apply).toHaveBeenCalledTimes(1);
	});
});
