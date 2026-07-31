export type MoveSpeed = 'slow' | 'normal' | 'fast';

export const MOVE_SPEEDS: readonly MoveSpeed[] = ['slow', 'normal', 'fast'];

export const DEFAULT_MOVE_SPEED: MoveSpeed = 'normal';

export const MOVE_SPEED_LABEL: Record<MoveSpeed, string> = {
	slow: 'Slow',
	normal: 'Normal',
	fast: 'Fast',
};

/** Pause before the piece lights up. */
export const REPLAY_DELAY = 300;

/** Time the machine appears to think before it reveals its move. */
export const THINK_DELAY = 350;

/** How long it stays lit before it slides to its destination. */
export const ANNOUNCE_DELAY = 450;

/** How long the piece takes to travel across the board. */
export const SLIDE_DURATION = 220;

const SPEED_FACTOR: Record<MoveSpeed, number> = { slow: 1.6, normal: 1, fast: 0.5 };

export function scaleForSpeed(duration: number, speed: MoveSpeed): number {
	return Math.round(duration * SPEED_FACTOR[speed]);
}

export function normalizeMoveSpeed(value: unknown): MoveSpeed {
	return MOVE_SPEEDS.includes(value as MoveSpeed) ? (value as MoveSpeed) : DEFAULT_MOVE_SPEED;
}
