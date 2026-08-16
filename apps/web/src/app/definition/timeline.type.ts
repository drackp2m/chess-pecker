import { PuzzleMove } from '@app/definition/puzzle.type';

export type TimelineLineKind = 'main' | 'variation' | 'exploration';

export interface TimelineLine {
	readonly id: number;
	readonly parent: number | undefined;
	readonly at: number;
	readonly moves: readonly PuzzleMove[];
	readonly kind: TimelineLineKind;
	readonly run: number | undefined;
}

export interface TimelineHead {
	readonly line: number;
	readonly ply: number;
}

export interface Timeline {
	readonly lines: readonly TimelineLine[];
	readonly head: TimelineHead;
}
