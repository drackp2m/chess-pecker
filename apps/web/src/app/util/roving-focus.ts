export interface RovingPosition {
	readonly column: number;
	readonly row: number;
}

export interface RovingGridSize {
	readonly columns: number;
	readonly rows: number;
}

export type RovingGuard = (position: RovingPosition) => boolean;

interface RovingStep {
	readonly start: RovingPosition;
	readonly delta: RovingPosition;
}

const ARROWS: Record<string, RovingPosition> = {
	ArrowLeft: { column: -1, row: 0 },
	ArrowRight: { column: 1, row: 0 },
	ArrowUp: { column: 0, row: -1 },
	ArrowDown: { column: 0, row: 1 },
};

export function moveRovingFocus(
	key: string,
	position: RovingPosition,
	size: RovingGridSize,
	isEnabled: RovingGuard,
): RovingPosition | null {
	const step = toStep(key, position, size);

	if (null === step) {
		return null;
	}

	let next = step.start;

	while (isInside(next, size)) {
		if (isEnabled(next)) {
			return next;
		}

		next = shift(next, step.delta);
	}

	return null;
}

export function lastRovingPosition(
	size: RovingGridSize,
	isEnabled: RovingGuard,
): RovingPosition | null {
	for (let column = size.columns - 1; 0 <= column; column--) {
		for (let row = size.rows - 1; 0 <= row; row--) {
			const position = { column, row };

			if (isEnabled(position)) {
				return position;
			}
		}
	}

	return null;
}

export function rovingIndex(position: RovingPosition, size: RovingGridSize): number {
	return position.column * size.rows + position.row;
}

function toStep(key: string, position: RovingPosition, size: RovingGridSize): RovingStep | null {
	const arrow = ARROWS[key];

	if (undefined !== arrow) {
		return { start: shift(position, arrow), delta: arrow };
	}

	if ('Home' === key) {
		return { start: { column: 0, row: position.row }, delta: { column: 1, row: 0 } };
	}

	if ('End' === key) {
		return {
			start: { column: size.columns - 1, row: position.row },
			delta: { column: -1, row: 0 },
		};
	}

	return null;
}

function shift(position: RovingPosition, delta: RovingPosition): RovingPosition {
	return { column: position.column + delta.column, row: position.row + delta.row };
}

function isInside(position: RovingPosition, size: RovingGridSize): boolean {
	return (
		0 <= position.column &&
		position.column < size.columns &&
		0 <= position.row &&
		position.row < size.rows
	);
}
