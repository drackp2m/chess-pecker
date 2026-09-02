const DAY_MS = 24 * 60 * 60 * 1000;

export function zoneDayLabel(date: Date, timeZone: string): string {
	const parts = new Intl.DateTimeFormat('en', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(date);

	const year = parts.find((part) => 'year' === part.type)?.value;
	const month = parts.find((part) => 'month' === part.type)?.value;
	const day = parts.find((part) => 'day' === part.type)?.value;

	return `${year ?? '0000'}-${month ?? '00'}-${day ?? '00'}`;
}

export function labelToUtcMidnight(label: string): Date {
	const [year, month, day] = label.split('-').map(Number);

	return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
}

export function addLabelDays(label: string, amount: number): string {
	return new Date(labelToUtcMidnight(label).getTime() + amount * DAY_MS).toISOString().slice(0, 10);
}

export function diffLabelDays(from: string, to: string): number {
	return Math.round(
		(labelToUtcMidnight(to).getTime() - labelToUtcMidnight(from).getTime()) / DAY_MS,
	);
}
