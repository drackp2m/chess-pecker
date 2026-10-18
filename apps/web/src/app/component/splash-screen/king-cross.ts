import type { KingPose } from '@app/component/splash-screen/king-motion';

const CROSS_DEPTH = 24;
const CROSS_FROM = 100;
const CROSS_TO = 112;
const CROSS_FACING = (45 * Math.PI) / 180;
const CROSS_ROUNDNESS = 1.2;
const NUDGE = 1e-4;

export interface Solid {
	readonly x: number;
	readonly z: number;
}

export function bodyWeight(y: number): number {
	const t = Math.min(1, Math.max(0, (y - CROSS_FROM) / (CROSS_TO - CROSS_FROM)));

	return t * t * (3 - 2 * t);
}

export function crossEdge(r: number, pose: KingPose, side: number): Solid {
	const turn = pose.turn - CROSS_FACING;
	const cos = Math.cos(turn);
	const sin = Math.sin(turn);
	const depth = Math.min(r, CROSS_DEPTH);
	const ellipse = Math.hypot(r * cos, depth * sin);

	return {
		x: side * support(r, depth, turn),
		z: 0 < ellipse ? (side * (r ** 2 - depth ** 2) * sin * cos) / ellipse : 0,
	};
}

export function crossSection(r: number, y: number, facing: number, pose: KingPose): Solid {
	const body = bodyWeight(y);

	if (1 === body) {
		return { x: r * Math.cos(facing), z: r * Math.sin(facing) };
	}

	const turn = pose.turn - CROSS_FACING;
	const depth = Math.min(r, CROSS_DEPTH);
	const reach = (angle: number): number => body * r + (1 - body) * support(r, depth, angle - turn);
	const slope = (reach(facing + NUDGE) - reach(facing - NUDGE)) / (2 * NUDGE);
	const out = reach(facing);

	return {
		x: out * Math.cos(facing) - slope * Math.sin(facing),
		z: out * Math.sin(facing) + slope * Math.cos(facing),
	};
}

function support(across: number, deep: number, angle: number): number {
	const wide = Math.abs(across * Math.cos(angle)) ** CROSS_ROUNDNESS;
	const thick = Math.abs(deep * Math.sin(angle)) ** CROSS_ROUNDNESS;

	return (wide + thick) ** (1 / CROSS_ROUNDNESS);
}
