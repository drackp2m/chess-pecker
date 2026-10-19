const SECOND_MS = 1000;
const SPIN_MS = 8000;
const WOBBLE = (10 * Math.PI) / 180;

export interface KingPose {
	readonly turn: number;
	readonly lean: number;
	readonly pitch: number;
}

export interface KingFrame {
	readonly time: number;
	readonly pose: KingPose;
	readonly width: number;
	readonly height: number;
}

export type KingPainter = (frame: KingFrame) => void;

export const KING_REST: KingPose = { turn: 0, lean: 0, pitch: 0 };

export function kingPose(now: number): KingPose {
	const turn = ((2 * Math.PI * now) / SPIN_MS) % (2 * Math.PI);

	return { turn, lean: WOBBLE * Math.cos(turn), pitch: WOBBLE * Math.sin(turn) };
}

export function animateKing(face: HTMLElement, painters: readonly KingPainter[]): void {
	const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const animate = (now: number): void => {
		if (!face.isConnected) {
			return;
		}

		const frame = {
			time: still ? 0 : now / SECOND_MS,
			pose: still ? KING_REST : kingPose(now),
			width: face.offsetWidth,
			height: face.offsetHeight,
		};

		for (const paint of painters) {
			paint(frame);
		}

		requestAnimationFrame(animate);
	};

	animate(performance.now());
}

export function whenChanged<T>(paint: (scene: T) => void): (scene: T) => void {
	let drawn = '';

	return (scene) => {
		const key = JSON.stringify(scene);

		if (key !== drawn) {
			drawn = key;
			paint(scene);
		}
	};
}
