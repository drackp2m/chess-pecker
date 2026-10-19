import type { Box, Point } from '@app/component/splash-screen/geometry';
import { kingPose } from '@app/component/splash-screen/king-motion';
import { kingOutline } from '@app/component/splash-screen/king-outline';

const STATUS_MS = 200;
const HALO_MS = 400;
const FADE_MS = 1200;
const ZOOM_MS = 1300;
const QUIET_MS = 300;
const FLIGHT_PEAK = 0.6;
const KING_NECK = 0.13;
const KING_WAIST = 0.125;
const COVER_MARGIN = 1.3;

interface SplashParts {
	readonly backdrop: HTMLElement;
	readonly halo: HTMLElement;
	readonly king: HTMLElement;
	readonly face: HTMLElement;
	readonly status: HTMLElement;
}

interface RevealPlan {
	readonly hole: Box;
	readonly centre: Point;
	readonly origin: Point;
	readonly shift: Point;
	readonly scale: number;
	readonly settle: number;
	readonly span: number;
}

export async function revealApp(splash: Element, stage: HTMLElement): Promise<void> {
	const parts = partsOf(splash);

	if (undefined === parts || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		await settled([fadeOut(splash, QUIET_MS)]);

		return;
	}

	const plan = planReveal(parts, stage);

	await Promise.all([
		settled([
			fadeOut(parts.status, STATUS_MS),
			fadeOut(parts.halo, HALO_MS),
			fadeOut(parts.face, FADE_MS),
		]),
		fly(parts, stage, plan),
	]);
	stage.style.removeProperty('transform');
	stage.style.removeProperty('transform-origin');
}

function partsOf(splash: Element): SplashParts | undefined {
	const backdrop = splash.querySelector<HTMLElement>('.backdrop');
	const halo = splash.querySelector<HTMLElement>('.halo');
	const king = splash.querySelector<HTMLElement>('.king');
	const face = splash.querySelector<HTMLElement>('.face');
	const status = splash.querySelector<HTMLElement>('.status');

	if (null === backdrop || null === halo || null === king || null === face || null === status) {
		return undefined;
	}

	return { backdrop, halo, king, face, status };
}

function planReveal(parts: SplashParts, stage: HTMLElement): RevealPlan {
	const view = parts.backdrop.getBoundingClientRect();
	const king = parts.king.getBoundingClientRect();
	const area = stage.getBoundingClientRect();
	const hole = { x: king.x - view.x, y: king.y - view.y, width: king.width, height: king.height };
	const centre = { x: view.width / 2, y: view.height / 2 };
	const scale = Math.max(hole.width / view.width, hole.height / view.height);
	const needed = Math.max(view.height / (2 * KING_WAIST), view.width / KING_NECK) * COVER_MARGIN;
	const reach = Math.max(1, (needed * scale) / hole.height);

	return {
		hole,
		centre,
		origin: { x: view.x + centre.x - area.x, y: view.y + centre.y - area.y },
		shift: { x: hole.x + hole.width / 2 - centre.x, y: hole.y + hole.height / 2 - centre.y },
		scale,
		settle: -Math.log(scale),
		span: Math.log(reach / scale),
	};
}

function fly(parts: SplashParts, stage: HTMLElement, plan: RevealPlan): Promise<void> {
	return new Promise((resolve) => {
		let start: number | undefined;

		const frame = (now: number): void => {
			start ??= now;

			const progress = Math.min(1, (now - start) / ZOOM_MS);

			paint(parts, stage, plan, progress, now);

			if (1 > progress) {
				requestAnimationFrame(frame);
			} else {
				resolve();
			}
		};

		requestAnimationFrame(frame);
	});
}

function paint(
	parts: SplashParts,
	stage: HTMLElement,
	plan: RevealPlan,
	progress: number,
	now: number,
): void {
	const drift = stageDrift(plan, progress);
	const zoom = Math.exp(plan.span * flight(progress));
	const flown = moved(plan.shift, drift - 1, zoom);
	const centre = {
		x: plan.centre.x + plan.shift.x * drift,
		y: plan.centre.y + plan.shift.y * drift,
	};
	const hole = kingOutline(kingPose(now), (point) => ({
		x: centre.x + zoom * (point.x - 0.5) * plan.hole.width,
		y: centre.y + zoom * (point.y - 0.5) * plan.hole.height,
	}));

	stage.style.transformOrigin = `${px(plan.origin.x)} ${px(plan.origin.y)}`;
	stage.style.transform = moved(plan.shift, drift, plan.scale ** drift);
	parts.halo.style.transform = flown;
	parts.king.style.transform = flown;
	parts.backdrop.style.clipPath = `path('${frameOf(plan)} ${hole}')`;
}

function moved(shift: Point, share: number, scale: number): string {
	return `translate(${px(shift.x * share)}, ${px(shift.y * share)}) scale(${scale.toString()})`;
}

function frameOf(plan: RevealPlan): string {
	const width = (2 * plan.centre.x).toFixed(1);
	const height = (2 * plan.centre.y).toFixed(1);

	return `M0 0V${height}H${width}V0Z`;
}

function stageDrift(plan: RevealPlan, progress: number): number {
	const travelled = plan.span * flight(progress);
	const t = 0 < plan.settle ? Math.min(1, travelled / plan.settle) : 1;

	return (1 - t) ** 2 * (1 + t);
}

function flight(progress: number): number {
	return FLIGHT_PEAK > progress
		? progress ** 2 / FLIGHT_PEAK
		: 1 - (1 - progress) ** 2 / (1 - FLIGHT_PEAK);
}

function fadeOut(element: Element, duration: number): Animation {
	return element.animate([{ opacity: 1 }, { opacity: 0 }], { duration, fill: 'forwards' });
}

async function settled(animations: Animation[]): Promise<void> {
	await Promise.allSettled(animations.map((animation) => animation.finished));
}

function px(value: number): string {
	return `${value.toFixed(2)}px`;
}
