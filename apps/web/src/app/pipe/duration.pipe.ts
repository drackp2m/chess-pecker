import { Pipe, PipeTransform } from '@angular/core';

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
	transform(milliseconds: number | null | undefined): string {
		if (null === milliseconds || undefined === milliseconds || 0 === milliseconds) {
			return '—';
		}

		const total = Math.round(milliseconds / MS_PER_SECOND);
		const hours = Math.floor(total / SECONDS_PER_HOUR);
		const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
		const seconds = total % SECONDS_PER_MINUTE;

		const parts = [
			[hours, 'h'],
			[minutes, 'm'],
			[seconds, 's'],
		] as const;

		const formatted = parts
			.filter(([value]) => 0 !== value)
			.map(([value, unit]) => `${value.toString()}${unit}`);

		return 0 === formatted.length ? '—' : formatted.join(' ');
	}
}
