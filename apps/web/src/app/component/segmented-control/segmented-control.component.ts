import {
	Component,
	DestroyRef,
	computed,
	contentChildren,
	effect,
	inject,
	input,
	signal,
} from '@angular/core';

import { SegmentDirective } from '@app/directive/segment/segment.directive';

interface SegmentMetrics {
	readonly offset: number;
	readonly width: number;
}

@Component({
	selector: 'app-segmented-control',
	templateUrl: './segmented-control.component.html',
	styleUrl: './segmented-control.component.scss',
	host: {
		role: 'radiogroup',
		'[attr.aria-label]': 'ariaLabel() ?? null',
		'[class.is-measured]': 'measured()',
		'[class.has-selection]': '-1 !== selectedIndex()',
		'[style.--marker-left]': 'markerLeft()',
		'[style.--marker-width]': 'markerWidth()',
	},
})
export class SegmentedControlComponent {
	readonly ariaLabel = input<string>();

	protected readonly measured = signal(false);

	private readonly segments = contentChildren(SegmentDirective, { descendants: true });
	private readonly metrics = signal<readonly SegmentMetrics[]>([]);

	protected readonly selectedIndex = computed(() =>
		this.segments().findIndex((segment) => segment.checked()),
	);

	private readonly selected = computed(() => this.metrics()[this.selectedIndex()]);

	protected readonly markerLeft = computed(() => `${(this.selected()?.offset ?? 0).toString()}px`);
	protected readonly markerWidth = computed(() => `${(this.selected()?.width ?? 0).toString()}px`);

	private readonly observer = new ResizeObserver(() => {
		this.measure();
	});

	constructor() {
		effect(() => {
			this.observer.disconnect();

			for (const element of this.elements()) {
				this.observer.observe(element);
			}
		});

		effect(() => {
			this.segments().forEach((segment, index) => {
				const offset = this.metrics()[index]?.offset ?? 0;

				segment.element()?.style.setProperty('--segment-offset', `${offset.toString()}px`);
			});
		});

		inject(DestroyRef).onDestroy(() => {
			this.observer.disconnect();
		});
	}

	private elements(): readonly HTMLElement[] {
		const elements: HTMLElement[] = [];

		for (const segment of this.segments()) {
			const element = segment.element();

			if (undefined !== element) {
				elements.push(element);
			}
		}

		return elements;
	}

	private measure(): void {
		this.metrics.set(
			this.segments().map((segment) => ({
				offset: segment.element()?.offsetLeft ?? 0,
				width: segment.element()?.offsetWidth ?? 0,
			})),
		);

		if (!this.measured()) {
			requestAnimationFrame(() => {
				this.measured.set(true);
			});
		}
	}
}
