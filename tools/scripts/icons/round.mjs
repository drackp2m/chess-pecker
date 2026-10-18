import { flatten, paper, point } from './geometry.mjs';

const MIN_TURN = 3;
const MAX_TRIM_SHARE = 0.48;
const MIN_LENGTH = 0.01;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const isFilledOnTheRight = (item) =>
	flatten(item).reduce((a, b) => (Math.abs(b.area) > Math.abs(a.area) ? b : a)).clockwise;

const cornerAt = (previous, next, { radius, inner, right }) => {
	const turn = previous.getTangentAtTime(1).getDirectedAngle(next.getTangentAtTime(0));
	const convex = right ? 0 < turn : 0 > turn;
	const wanted = convex ? radius : inner;

	if (MIN_TURN > Math.abs(turn) || 0 >= wanted) {
		return null;
	}

	const half = toRadians(Math.abs(turn)) / 2;
	const room = MAX_TRIM_SHARE * Math.min(previous.length, next.length);
	const trim = Math.min(wanted * Math.tan(half), room);

	return { trim, handle: (4 / 3) * Math.tan(half / 2) * (trim / Math.tan(half)) };
};

const trimCurve = (curve, start, end) => {
	const from = 0 < start ? curve.getTimeAt(start) : 0;
	const to = 0 < end ? curve.getTimeAt(curve.length - end) : 1;

	return curve.getPart(from ?? 0, to ?? 1).getValues();
};

const direction = (vector, fallback) =>
	(MIN_LENGTH < vector.length ? vector : fallback).normalize();

const addFillet = (path, before, after, handle) => {
	const end = point(before[6], before[7]);
	const start = point(after[0], after[1]);
	const leaving = direction(
		end.subtract(point(before[4], before[5])),
		end.subtract(point(before[0], before[1])),
	);
	const arriving = direction(
		point(after[2], after[3]).subtract(start),
		point(after[6], after[7]).subtract(start),
	);

	path.cubicCurveTo(
		end.add(leaving.multiply(handle)),
		start.subtract(arriving.multiply(handle)),
		start,
	);
};

const roundPath = (path, options) => {
	const curves = path.curves.filter((curve) => MIN_LENGTH < curve.length);
	const count = curves.length;

	if (2 > count) {
		return path.clone();
	}

	const at = (index) => (index + count) % count;
	const corners = curves.map((curve, index) => cornerAt(curves[at(index - 1)], curve, options));
	const trimOf = (index) => corners[at(index)]?.trim ?? 0;
	const parts = curves.map((curve, index) => trimCurve(curve, trimOf(index), trimOf(index + 1)));
	const result = new paper.Path();

	result.moveTo(point(parts[0][0], parts[0][1]));

	parts.forEach((part, index) => {
		if (0 < index && corners[index]) {
			addFillet(result, parts[index - 1], part, corners[index].handle);
		}

		result.cubicCurveTo(point(part[2], part[3]), point(part[4], part[5]), point(part[6], part[7]));
	});

	if (corners[0]) {
		addFillet(result, parts[count - 1], parts[0], corners[0].handle);
	}

	result.closePath();

	return result;
};

export const round = (item, radius, inner = radius) => {
	const options = { radius, inner, right: isFilledOnTheRight(item) };
	const paths = flatten(item).map((path) => roundPath(path, options));

	return 1 === paths.length ? paths[0] : new paper.CompoundPath({ children: paths });
};
