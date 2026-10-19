import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';

@Directive({
	selector: '[appPixelGrid]',
})
export class PixelGridDirective {
	readonly appPixelGrid = input.required<number>();

	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

	constructor() {
		const destroyRef = inject(DestroyRef);

		afterNextRender(() => {
			if ('undefined' === typeof ResizeObserver) {
				return;
			}

			const observer = new ResizeObserver(([entry]) => {
				this.lay(entry?.contentRect.width ?? 0);
			});

			observer.observe(this.host.nativeElement);

			destroyRef.onDestroy(() => {
				observer.disconnect();
			});
		});
	}

	private lay(width: number): void {
		const tracks = pixelTracks(width, this.appPixelGrid(), window.devicePixelRatio);
		const { style } = this.host.nativeElement;

		style.gridTemplateColumns = tracks;
		style.gridTemplateRows = tracks;
	}
}

function pixelTracks(width: number, count: number, ratio: number): string {
	const pixels = Math.round(width * ratio);

	if (0 >= pixels) {
		return '';
	}

	const edge = (index: number): number => Math.round((pixels * index) / count);
	const tracks = Array.from(
		{ length: count - 1 },
		(_unused, index) => `${((edge(index + 1) - edge(index)) / ratio).toString()}px`,
	);

	return [...tracks, 'minmax(0, 1fr)'].join(' ');
}
