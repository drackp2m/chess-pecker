const DAY_MS = 24 * 60 * 60 * 1000;

export function utcMidnight(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addUtcDays(date: Date, amount: number): Date {
	return new Date(date.getTime() + amount * DAY_MS);
}

export function diffUtcDays(from: Date, to: Date): number {
	return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

export function toIsoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}
