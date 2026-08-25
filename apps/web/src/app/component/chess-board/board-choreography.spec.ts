import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SLIDE_DURATION } from '@app/definition/move-speed.type';
import { mountBoard, restoreAnimations } from '@app/testing/board-presenter.harness';

/** Rooks facing each other on the fourth rank, well away from either king. */
const CAPTURE = '4k3/8/8/8/3rR3/8/8/4K3 w - - 0 1';
/** Bare kings and rooks, every castling right alive and no square in the way. */
const CASTLING = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
/** Black has just pushed d7-d5 past the white pawn on e5, so exd6 is legal. */
const EN_PASSANT = '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2';
/** A pawn one square from home, promoting on a file no king can see. */
const PROMOTION = '8/7P/8/8/8/k7/8/4K3 w - - 0 1';
/** Black to move, against a white knight at home with three squares to go to. */
const REPLY = '4k3/8/8/8/8/8/3r4/4K1N1 b - - 0 1';

describe('the board as a move crosses it', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		restoreAnimations();
		TestBed.resetTestingModule();
	});

	it('sends nothing travelling until a move is played', () => {
		const board = mountBoard(CAPTURE);

		expect(board.sliding()).toEqual([]);
		expect(board.pieceAt('e4')).toBe('white rook');
		expect(board.pieceAt('d4')).toBe('black rook');
	});

	it('sends only the square the move landed on travelling', () => {
		const board = mountBoard(CAPTURE);

		board.play('e4d4');

		expect(board.pieceAt('d4')).toBe('white rook');
		expect(board.pieceAt('e4')).toBeUndefined();
		expect(board.sliding()).toEqual([{ square: 'd4', transform: 'translate(100%, 0%)' }]);
	});

	/**
	 * The two beats the plan gives it, as they are actually drawn: the rook is round
	 * before the king sets off, and the king is still standing on e1 while it goes.
	 */
	it('castles in two beats, the king waiting on e1 while the rook goes round', () => {
		const board = mountBoard(CASTLING);

		board.play('e1g1');

		expect(board.pieceAt('f1')).toBe('white rook');
		expect(board.pieceAt('e1')).toBe('white king');
		expect(board.pieceAt('h1')).toBeUndefined();
		expect(board.sliding()).toEqual([{ square: 'f1', transform: 'translate(200%, 0%)' }]);

		board.advance(SLIDE_DURATION);

		expect(board.pieceAt('g1')).toBe('white king');
		expect(board.pieceAt('e1')).toBeUndefined();
		expect(board.sliding()).toEqual([{ square: 'g1', transform: 'translate(-200%, 0%)' }]);
	});

	/**
	 * The pawn is taken on a square it does not stand on, so it is walked onto that
	 * square first and taken there like anything else.
	 */
	it('takes en passant in two beats, the captured pawn stepping onto d6 first', () => {
		const board = mountBoard(EN_PASSANT);

		board.play('e5d6');

		expect(board.pieceAt('d6')).toBe('black pawn');
		expect(board.pieceAt('d5')).toBeUndefined();
		expect(board.sliding()).toEqual([{ square: 'd6', transform: 'translate(0%, 100%)' }]);

		board.advance(SLIDE_DURATION);

		expect(board.pieceAt('d6')).toBe('white pawn');
		expect(board.takenAt('d6')).toBe('black pawn');
		expect(board.sliding()).toEqual([{ square: 'd6', transform: 'translate(100%, 100%)' }]);
	});

	it('lights the square a move is about to be played from, and puts it out on arrival', () => {
		const board = mountBoard(CAPTURE);

		board.announce('e4d4');

		expect(board.isAnnounced('e4')).toBe(true);

		board.play('e4d4');

		expect(board.isAnnounced('e4')).toBe(false);
	});

	/** Flipping is a way of looking at the board, not a move to be run again. */
	it('does not restart a slide that is already running when the board is flipped', () => {
		const board = mountBoard(CAPTURE);

		board.play('e4d4');

		const before = board.sliding();

		board.flip();

		expect(board.sliding()).toEqual(before);
		expect(board.slideCount()).toBe(1);
	});

	/**
	 * The square keeps its element across positions, so a slide left running over a board
	 * that jumped would show the mover turning into the piece it was taking.
	 */
	it('calls off a slide when the board jumps out from under it', () => {
		const board = mountBoard(CAPTURE);

		board.play('e4d4');
		board.jumpTo(CAPTURE);

		expect(board.pieceAt('d4')).toBe('black rook');
		expect(board.sliding()).toEqual([]);
	});

	it('offers the promotion picker while one is pending', () => {
		const board = mountBoard(PROMOTION);

		expect(board.isPromotionOpen()).toBe(false);

		board.presenter.pendingPromotion.set({ from: 'h7', to: 'h8' });
		board.render();

		expect(board.isPromotionOpen()).toBe(true);
	});

	it('leaves the piece being taken standing until the one taking it arrives', () => {
		const board = mountBoard(CAPTURE);

		board.play('e4d4');

		expect(board.pieceAt('d4')).toBe('white rook');
		expect(board.takenAt('d4')).toBe('black rook');

		board.advance(SLIDE_DURATION);

		expect(board.pieceAt('d4')).toBe('white rook');
		expect(board.takenAt('d4')).toBeUndefined();
	});

	it('travels a promoting pawn as a pawn, and changes it on arrival', () => {
		const board = mountBoard(PROMOTION);

		board.play('h7h8q');

		expect(board.pieceAt('h8')).toBe('white pawn');

		board.advance(SLIDE_DURATION);

		expect(board.pieceAt('h8')).toBe('white queen');
	});

	it('holds the check back until the piece giving it has arrived', () => {
		const board = mountBoard(CASTLING);

		board.play('a1a8');

		expect(board.isChecked('e8')).toBe(false);

		board.advance(SLIDE_DURATION);

		expect(board.isChecked('e8')).toBe(true);
	});

	it('holds a piece pressed while something is still travelling, and gives it up on arrival', () => {
		const board = mountBoard(CAPTURE);

		board.play('e4d4');
		board.click('e1');

		expect(board.picked()).toEqual([]);

		board.advance(SLIDE_DURATION);

		expect(board.picked()).toEqual(['e1']);
	});

	it('holds a piece pressed while a move is only lit and has not set off', () => {
		const board = mountBoard(CAPTURE);

		board.announce('e4d4');
		board.click('e1');

		expect(board.picked()).toEqual([]);

		board.play('e4d4');
		board.advance(SLIDE_DURATION);

		expect(board.picked()).toEqual(['e1']);
	});

	it('holds a piece pressed in the pause between the beats of a line', () => {
		const board = mountBoard(CAPTURE);

		board.presenter.isBusy.set(true);
		board.play('e4d4');
		board.advance(SLIDE_DURATION);

		expect(board.sliding()).toEqual([]);

		board.click('e1');

		expect(board.picked()).toEqual([]);

		board.presenter.isBusy.set(false);
		board.render();

		expect(board.picked()).toEqual(['e1']);
	});

	/** A whole move given over the opponent's, which is what the holding is for. */
	it('gives up a move pressed while the opponent was crossing, in the order it was given', () => {
		const board = mountBoard(CAPTURE);

		board.play('e4d4');
		board.click('e1');
		board.click('e2');

		expect(board.picked()).toEqual([]);

		board.advance(SLIDE_DURATION);

		expect(board.picked()).toEqual(['e1', 'e2']);
	});

	/** The whole point of holding rather than playing: the piece on screen is left alone. */
	it('leaves the piece travelling when a move is pressed over it', () => {
		const board = mountBoard(CAPTURE);

		board.play('e4d4');
		board.click('e1');
		board.click('e2');

		expect(board.sliding()).toEqual([{ square: 'd4', transform: 'translate(100%, 0%)' }]);
		expect(board.slideCount()).toBe(1);
	});

	it('draws the piece it is holding as picked up until the board takes it', () => {
		const board = mountBoard(CAPTURE);

		board.play('e4d4');
		board.click('e1');

		expect(board.isSelected('e1')).toBe(true);

		board.advance(SLIDE_DURATION);

		expect(board.isSelected('e1')).toBe(false);
	});

	/** Only a piece of the player's is echoed: an empty square is nothing to pick up. */
	it('draws nothing picked up for a held square with no piece of its own', () => {
		const board = mountBoard(CAPTURE);

		board.play('e4d4');
		board.click('e2');

		expect(board.isSelected('e2')).toBe(false);
	});

	it('marks where a piece held while the opponent is crossing may go', () => {
		const board = mountBoard(REPLY);

		board.play('d2a2');
		board.click('g1');

		expect(board.isSelected('g1')).toBe(true);
		expect(board.targets()).toEqual(['e2', 'f3', 'h3']);
	});

	/**
	 * The move being lit up is going to be played, so the marks are read past it: the knight
	 * has one square left once the rook lands beside the king, and it is the rook's own.
	 */
	it('marks a held piece against the board the move being lit up is heading for', () => {
		const board = mountBoard(REPLY);

		board.announce('d2e2');
		board.click('g1');

		expect(board.targets()).toEqual(['e2']);
	});

	it('takes no piece up at all while the board is shut', () => {
		const board = mountBoard(REPLY);

		board.presenter.isLocked.set(true);
		board.play('d2a2');
		board.click('g1');

		expect(board.isSelected('g1')).toBe(false);
		expect(board.targets()).toEqual([]);
	});
});
