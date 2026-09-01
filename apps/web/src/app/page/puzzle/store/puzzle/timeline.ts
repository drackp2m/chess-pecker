import { ChessMove, ChessPosition, PieceColor } from '@app/definition/chess.type';
import {
	FreePlayRun,
	Puzzle,
	PuzzleEvent,
	PuzzleMove,
	PuzzleRecord,
} from '@app/definition/puzzle.type';
import { Timeline, TimelineLine, TimelineLineKind } from '@app/definition/timeline.type';
import { HINT, RESTART } from '@app/page/puzzle/store/puzzle/record';
import {
	LineState,
	RevealedLine,
	findDeviation,
	toRecord,
} from '@app/page/puzzle/store/puzzle/session';
import { ChessBoard } from '@app/util/chess/chess-board';
import { ChessFen } from '@app/util/chess/chess-fen';
import { ChessNotation } from '@app/util/chess/chess-notation';

export interface TimelineInput {
	readonly fen: string;
	readonly record: PuzzleRecord;
	readonly freePlayIndex: number | undefined;
	readonly freePlayScratch: readonly PuzzleEvent[] | undefined;
	readonly revealed: RevealedLine | undefined;
	readonly rewound: number;
	readonly puzzle: Puzzle | undefined;
}

interface Branch {
	readonly id: number;
	readonly kind: TimelineLineKind;
	readonly run: number | undefined;
	parent: number | undefined;
	at: number;
	moves: PuzzleMove[];
	positions: ChessPosition[];
}

interface Cursor {
	readonly branch: Branch;
	readonly ply: number;
}

interface Floor {
	readonly branch: Branch;
	readonly plies: number;
}

interface Draft {
	readonly branches: Branch[];
	readonly opponent: PieceColor;
	readonly puzzle: Puzzle | undefined;
	cursor: Cursor;
	run: number | undefined;
}

function addBranch(draft: Draft, seed: Omit<Branch, 'id'>): Branch {
	const branch: Branch = { ...seed, id: draft.branches.length };

	draft.branches.push(branch);

	return branch;
}

function parentOf(draft: Draft, branch: Branch): Branch | undefined {
	return undefined === branch.parent ? undefined : draft.branches[branch.parent];
}

function endOf(branch: Branch): number {
	return branch.at + branch.moves.length;
}

function positionOf(branch: Branch, ply: number): ChessPosition {
	const position = branch.positions[ply - branch.at];

	if (undefined === position) {
		throw new SyntaxError(`the record does not replay: no board at ply ${ply.toString()}`);
	}

	return position;
}

function isSameMove(played: ChessMove, move: ChessMove): boolean {
	return played.from === move.from && played.to === move.to && played.promotion === move.promotion;
}

function reanchor(draft: Draft, empty: Branch, above: Branch, to: number): Cursor {
	const based = seat(draft, above, to);

	empty.parent = based.branch.id;
	empty.at = based.ply;
	empty.positions = [positionOf(based.branch, based.ply)];

	return { branch: empty, ply: based.ply };
}

function seat(draft: Draft, from: Branch, to: number): Cursor {
	const above = parentOf(draft, from);

	if (0 === from.moves.length && undefined !== above) {
		return reanchor(draft, from, above, to);
	}

	let branch = from;

	while (to < branch.at) {
		const next = parentOf(draft, branch);

		if (undefined === next) {
			break;
		}

		branch = next;
	}

	return { branch, ply: Math.min(Math.max(to, branch.at), endOf(branch)) };
}

function write(draft: Draft, branch: Branch, position: ChessPosition, move: ChessMove): Cursor {
	branch.moves.push(toRecord(position, move, position.turn === draft.opponent));
	branch.positions.push(ChessBoard.apply(position, move));

	return { branch, ply: endOf(branch) };
}

function findChild(draft: Draft, branch: Branch, ply: number, move: ChessMove): Branch | undefined {
	return draft.branches.find((other) => {
		const [first] = other.moves;

		return (
			other.parent === branch.id &&
			other.at === ply &&
			other.run === draft.run &&
			undefined !== first &&
			isSameMove(first, move)
		);
	});
}

function demote(draft: Draft, branch: Branch, ply: number): void {
	const index = ply - branch.at;
	const tail = addBranch(draft, {
		kind: 'variation',
		run: branch.run,
		parent: branch.id,
		at: ply,
		moves: branch.moves.slice(index),
		positions: branch.positions.slice(index),
	});

	branch.moves = branch.moves.slice(0, index);
	branch.positions = branch.positions.slice(0, index + 1);

	for (const other of draft.branches) {
		if (other.id !== tail.id && other.parent === branch.id && ply < other.at) {
			other.parent = tail.id;
		}
	}
}

function branchOff(draft: Draft, position: ChessPosition, move: ChessMove): Cursor {
	const { branch, ply } = draft.cursor;
	const started = addBranch(draft, {
		kind: undefined === draft.run ? 'variation' : 'freePlay',
		run: draft.run,
		parent: branch.id,
		at: ply,
		moves: [],
		positions: [position],
	});

	return write(draft, started, position, move);
}

function advance(draft: Draft, position: ChessPosition, move: ChessMove): Cursor {
	const { branch, ply } = draft.cursor;
	const played = branch.moves[ply - branch.at];

	if (undefined !== played && isSameMove(played, move)) {
		return { branch, ply: ply + 1 };
	}

	const child = findChild(draft, branch, ply, move);

	if (undefined !== child) {
		return { branch: child, ply: ply + 1 };
	}

	if (branch.run !== draft.run) {
		return branchOff(draft, position, move);
	}

	if (undefined !== played) {
		demote(draft, branch, ply);
	}

	return write(draft, branch, position, move);
}

function playMove(draft: Draft, written: string): boolean {
	const { branch, ply } = draft.cursor;
	const position = positionOf(branch, ply);
	const move = ChessNotation.parse(position, written);

	if (undefined === move) {
		return false;
	}

	draft.cursor = advance(draft, position, move);

	return true;
}

function restart(draft: Draft, floor: Floor | undefined): Cursor {
	if (undefined === floor) {
		return seat(draft, draft.cursor.branch, Math.min(1, endOf(draft.cursor.branch)));
	}

	return seat(draft, floor.branch, Math.min(1, floor.plies));
}

function foldEvent(draft: Draft, event: PuzzleEvent, floor: Floor | undefined): void {
	if (HINT === event) {
		return;
	}

	if ('number' === typeof event) {
		const { branch, ply } = draft.cursor;

		draft.cursor = RESTART === event ? restart(draft, floor) : seat(draft, branch, ply + event);

		return;
	}

	if (!playMove(draft, event)) {
		const ply = draft.cursor.ply.toString();

		throw new SyntaxError(`the record does not replay: ${event} at ply ${ply}`);
	}
}

function chainOf(draft: Draft, branch: Branch): Branch[] {
	const chain: Branch[] = [];

	for (let current: Branch | undefined = branch; undefined !== current;) {
		chain.unshift(current);
		current = parentOf(draft, current);
	}

	return chain;
}

function flatten(draft: Draft, branch: Branch): Omit<LineState, 'cursor'> {
	const positions: ChessPosition[] = [];
	const line: PuzzleMove[] = [];
	const chain = chainOf(draft, branch);

	chain.forEach((current, index) => {
		const next = chain[index + 1];
		const upto = undefined === next ? current.moves.length : next.at - current.at;

		positions.push(...current.positions.slice(0, upto));
		line.push(...current.moves.slice(0, upto));
	});

	positions.push(...branch.positions.slice(branch.moves.length));

	return { positions, line };
}

function runFloor(draft: Draft, entry: Cursor): Floor {
	const flat = flatten(draft, entry.branch);

	return { branch: entry.branch, plies: findDeviation(flat, draft.puzzle) ?? flat.line.length };
}

function openRun(draft: Draft, index: number): Cursor {
	const { branch, ply } = draft.cursor;

	return {
		branch: addBranch(draft, {
			kind: 'freePlay',
			run: index,
			parent: branch.id,
			at: ply,
			moves: [],
			positions: [positionOf(branch, ply)],
		}),
		ply,
	};
}

function foldRun(draft: Draft, run: FreePlayRun, index: number): Cursor | undefined {
	const entry = draft.cursor;
	const mark = draft.branches.length;
	const floor = runFloor(draft, entry);

	draft.cursor = openRun(draft, index);
	draft.run = index;

	try {
		for (const event of run.events) {
			foldEvent(draft, event, floor);
		}
	} catch {
		draft.branches.length = mark;
		draft.cursor = entry;
		draft.run = undefined;

		return undefined;
	}

	const left = draft.cursor;

	draft.cursor = entry;
	draft.run = undefined;

	return left;
}

function foldLog(draft: Draft, record: PuzzleRecord): (Cursor | undefined)[] {
	const left: (Cursor | undefined)[] = [];
	let pending = 0;

	const openPending = (upto: number): void => {
		let run = record.freePlayRuns[pending];

		while (undefined !== run && run.at <= upto) {
			left[pending] = foldRun(draft, run, pending);
			pending += 1;
			run = record.freePlayRuns[pending];
		}
	};

	record.record.forEach((event, index) => {
		openPending(index);
		foldEvent(draft, event, undefined);
	});

	openPending(Number.POSITIVE_INFINITY);

	return left;
}

function foldRevealedInto(draft: Draft, revealed: RevealedLine | undefined): void {
	if (undefined === revealed) {
		return;
	}

	const stood = Math.min(Math.max(0, revealed.at), endOf(draft.cursor.branch));

	draft.cursor = seat(draft, draft.cursor.branch, stood);

	for (const written of revealed.moves) {
		if (!playMove(draft, written)) {
			return;
		}
	}
}

function startDraft(input: TimelineInput): Draft {
	const start = ChessFen.parse(input.fen);
	const root: Branch = {
		id: 0,
		kind: 'main',
		run: undefined,
		parent: undefined,
		at: 0,
		moves: [],
		positions: [start],
	};

	return {
		branches: [root],
		opponent: start.turn,
		puzzle: input.puzzle,
		cursor: { branch: root, ply: 0 },
		run: undefined,
	};
}

function toLine(branch: Branch): TimelineLine {
	return {
		id: branch.id,
		parent: branch.parent,
		at: branch.at,
		moves: branch.moves,
		kind: branch.kind,
		run: branch.run,
	};
}

/**
 * The sandbox of a closed exercise, hung off the board the log was left standing on. It is
 * kept nowhere, so it comes last: the rewind that stood the board there is already spent.
 */
function foldScratchInto(draft: Draft, input: TimelineInput): void {
	const events = input.freePlayScratch;

	if (undefined === events) {
		return;
	}

	const index = input.record.freePlayRuns.length;
	const mark = draft.branches.length;
	const entry = draft.cursor;
	const floor = runFloor(draft, entry);

	draft.cursor = openRun(draft, index);
	draft.run = index;

	try {
		for (const event of events) {
			foldEvent(draft, event, floor);
		}
	} catch {
		draft.branches.length = mark;
		draft.cursor = entry;
	}

	draft.run = undefined;
}

function build(input: TimelineInput): Timeline {
	const draft = startDraft(input);
	const left = foldLog(draft, input.record);
	const open = undefined === input.freePlayIndex ? undefined : left[input.freePlayIndex];

	if (undefined !== open) {
		draft.cursor = open;
		draft.run = input.freePlayIndex;
	}

	foldRevealedInto(draft, input.revealed);

	draft.cursor = seat(draft, draft.cursor.branch, draft.cursor.ply - input.rewound);
	foldScratchInto(draft, input);

	const { branch, ply } = draft.cursor;

	return { lines: draft.branches.map(toLine), head: { line: branch.id, ply } };
}

function blankTimeline(): Timeline {
	return {
		lines: [{ id: 0, parent: undefined, at: 0, moves: [], kind: 'main', run: undefined }],
		head: { line: 0, ply: 0 },
	};
}

export function projectTimeline(input: TimelineInput): Timeline {
	try {
		return build(input);
	} catch {
		return blankTimeline();
	}
}

export function timelineMoves(lines: readonly TimelineLine[], id: number): readonly PuzzleMove[] {
	const line = lines[id];

	if (undefined === line) {
		return [];
	}

	const above = undefined === line.parent ? [] : timelineMoves(lines, line.parent);

	return [...above.slice(0, line.at), ...line.moves];
}
