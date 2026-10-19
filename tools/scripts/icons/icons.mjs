import {
	arc,
	arrowHead,
	capsule,
	circle,
	growPolygon,
	intersect,
	line,
	mirror,
	pathOf,
	polar,
	polygon,
	rect,
	rotate,
	subtract,
	union,
} from './geometry.mjs';
import { round } from './round.mjs';

const STROKE = 64;
const GAP = 32;
const RADIUS = 28;
const INNER = 16;

const SINE_HANDLE = 0.3642;
const WAVE = [48, 80, 48, 80];

const ROTATION_RADIUS = 184;

const CHEVRON = [
	[96, 64],
	[288, 256],
	[96, 448],
];

const CHEVRON_DOWN = [
	[64, 160],
	[256, 352],
	[448, 160],
];

const HOUSE = [
	[256, 32],
	[496, 240],
	[496, 480],
	[16, 480],
	[16, 240],
];

const BOOKMARK = [
	[0, 0],
	[384, 0],
	[384, 512],
	[192, 392],
	[0, 512],
];

const GEAR_TOOTH = [
	[200, 136],
	[312, 136],
	[296, 8],
	[216, 8],
];

const SHARE_NODES = [
	[352, 104],
	[96, 256],
	[352, 408],
];

const BLADE = [
	[20, 20],
	[111, 57],
	[367, 313],
	[313, 367],
	[57, 111],
];

const I_STEM = [
	[214, 240],
	[250, 240],
	[250, 336],
];

const ONE = [
	[96, 116],
	[152, 76],
	[152, 236],
];

const triangle = (tip, back) =>
	polygon([
		[back, 24],
		[tip, 256],
		[back, 488],
	]);

const bar = () => capsule([32, 80], [32, 432], STROKE);

const stepBack = () => union(bar(), round(triangle(96, 320), RADIUS));

const restart = () => union(bar(), round(union(triangle(96, 300), triangle(310, 512)), RADIUS));

const chevronRight = () => round(line(CHEVRON, STROKE), 0, INNER);

const cross = (cx, cy, arm, width) =>
	union(
		capsule([cx - arm, cy - arm], [cx + arm, cy + arm], width),
		capsule([cx + arm, cy - arm], [cx - arm, cy + arm], width),
	);

const rotationArrow = (from, to) =>
	union(
		arc(256, 256, ROTATION_RADIUS, from, to, STROKE, [true, false]),
		round(arrowHead(256, 256, ROTATION_RADIUS, to, 256, 136), 32),
	);

const flipBoard = () => round(union(rotationArrow(113, 223), rotationArrow(293, 403)), 0, INNER);

const freePlay = () => {
	const ring = subtract(circle(192, 192, 192), circle(192, 192, 128));

	return round(union(ring, capsule([316, 316], [468, 468], 80)), 0, INNER);
};

const hint = () => {
	const stem = union(line(I_STEM, 56), arc(298, 336, 48, 90, 180, 56, [true, false]));

	return subtract(circle(256, 256, 256), circle(250, 136, 40), round(stem, 0, 12));
};

const profile = () => {
	const body = intersect(circle(256, 548, 212), circle(256, 256, 208));

	return round(subtract(circle(256, 256, 256), circle(256, 200, 92), body), RADIUS, INNER);
};

const settings = () => {
	const teeth = [0, 1, 2, 3, 4, 5, 6, 7].map((index) =>
		rotate(polygon(GEAR_TOOTH), index * 45, 256, 256),
	);

	return round(subtract(union(circle(256, 256, 184), ...teeth), circle(256, 256, 76)), 24);
};

const cloud = () =>
	round(
		union(
			circle(152, 328, 152),
			circle(280, 200, 168),
			circle(452, 232, 104),
			circle(504, 344, 136),
			rect(152, 280, 352, 200),
		),
		0,
		24,
	);

const offline = () => {
	const from = [180, 36];
	const to = [500, 476];
	const cut = subtract(cloud(), capsule(from, to, STROKE + GAP * 2));

	return round(union(cut, capsule(from, to, STROKE)), RADIUS, INNER);
};

const match = () => {
	const cell = 92;
	const squares = [0, 1, 2, 3].flatMap((row) =>
		[0, 1, 2, 3]
			.filter((column) => 0 === (row + column) % 2)
			.map((column) => rect(40 + column * cell, 72 + row * cell, cell, cell)),
	);

	return subtract(rect(0, 32, 448, 448, 56), ...squares);
};

const drawOffer = () =>
	round(
		union(
			line(ONE, 48),
			capsule([400, 72], [112, 440], 48),
			arc(368, 324, 64, 180, 390, 48, [true, false]),
			line([polar(368, 324, 64, 30), [304, 448], [448, 448]], 48),
		),
		0,
		12,
	);

const sword = () =>
	union(
		round(polygon(BLADE), 10, 8),
		capsule([296, 408], [408, 296], 48),
		capsule([352, 352], [436, 436], 40),
		circle(460, 460, 34),
	);

const newMatch = () => {
	const behind = subtract(mirror(sword(), 512), growPolygon(BLADE, 18));

	return round(union(sword(), behind), 0, INNER);
};

const home = () => round(subtract(polygon(HOUSE), rect(200, 320, 112, 240, 56)), RADIUS, INNER);

const share = () => {
	const nodes = SHARE_NODES.map(([x, y]) => circle(x, y, 88));
	const links = [0, 1].map((index) => capsule(SHARE_NODES[index], SHARE_NODES[index + 1], 44));

	return round(union(...nodes, ...links), 0, INNER);
};

const wave = (crests, left, right, height) => {
	const step = (right - left) / (crests.length - 1);
	const points = crests.map((y, index) => [left + index * step, y]);
	const lowered = points.map(([x, y]) => [x, y + height]).reverse();
	const curve = ([x1, y1], [x2, y2]) => {
		const pull = Math.sign(x2 - x1) * SINE_HANDLE * step;

		return `C${x1 + pull} ${y1} ${x2 - pull} ${y2} ${x2} ${y2}`;
	};
	const top = points.slice(1).map((to, index) => curve(points[index], to));
	const bottom = lowered.slice(1).map((to, index) => curve(lowered[index], to));

	return pathOf(`M${points[0].join(' ')}${top.join('')}V${lowered[0][1]}${bottom.join('')}Z`);
};

const resign = () => {
	const banner = round(wave(WAVE, 96, 448, 256), RADIUS, INNER);

	return union(capsule([32, 32], [32, 480], STROKE), banner);
};

const bookmark = () => intersect(round(polygon(BOOKMARK), RADIUS, 24), rect(0, 0, 384, 1024, 48));

const icon = (width, height, draw) => ({ width, height, draw });

export const ICONS = {
	bookmark: icon(384, 512, bookmark),
	'chevron-down': icon(512, 512, () => round(line(CHEVRON_DOWN, STROKE), 0, INNER)),
	'chevron-left': icon(320, 512, () => mirror(chevronRight(), 320)),
	'chevron-right': icon(320, 512, chevronRight),
	close: icon(384, 512, () => round(cross(192, 256, 128, STROKE), 0, INNER)),
	'draw-offer': icon(512, 512, drawOffer),
	'flip-board': icon(512, 512, flipBoard),
	'free-play': icon(512, 512, freePlay),
	hint: icon(512, 512, hint),
	home: icon(512, 512, home),
	match: icon(448, 512, match),
	'new-match': icon(512, 512, newMatch),
	offline: icon(640, 512, offline),
	profile: icon(512, 512, profile),
	resign: icon(448, 512, resign),
	restart: icon(512, 512, restart),
	settings: icon(512, 512, settings),
	share: icon(448, 512, share),
	'step-back': icon(320, 512, stepBack),
	'step-forward': icon(320, 512, () => mirror(stepBack(), 320)),
	sync: icon(640, 512, cloud),
};
