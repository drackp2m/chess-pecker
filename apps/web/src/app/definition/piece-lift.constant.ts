export const LIFT_SCALE = 1.15;

export const LIFT_SHADOW = 'drop-shadow(0 6px 6px rgb(0 0 0 / 40%))';

export const LIFT_FLAT = 'drop-shadow(0 0 0 rgb(0 0 0 / 0%))';

export const LIFT_DURATION = 140;

export const LIFT_SHARE = 0.25;

export const DEFAULT_MOVE_LIFT = true;

export function normalizeMoveLift(value: unknown): boolean {
	return 'boolean' === typeof value ? value : DEFAULT_MOVE_LIFT;
}
