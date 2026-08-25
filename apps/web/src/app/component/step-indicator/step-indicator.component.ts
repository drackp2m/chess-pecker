import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';

import { ScheduledAction } from '@app/util/scheduled-action';

interface StepSlot {
	readonly index: number;
	readonly offset: string;
}

type TravelPhase = 'departing' | 'idle' | 'moving';

const RESIZE_DURATION_MS = 130;

const TRAVEL_DURATION_MS = 280;

@Component({
	selector: 'app-step-indicator',
	templateUrl: './step-indicator.component.html',
	styleUrl: './step-indicator.component.scss',
	host: {
		role: 'progressbar',
		'[attr.aria-label]': 'ariaLabel() ?? null',
		'[attr.aria-valuemin]': '1',
		'[attr.aria-valuemax]': 'count()',
		'[attr.aria-valuenow]': 'index() + 1',
		'[class.is-traveling]': 'isTraveling()',
		'[style.--step-gaps]': 'gaps()',
		'[style.--step-position]': 'position()',
	},
})
export class StepIndicatorComponent {
	readonly count = input.required<number>();
	readonly index = input.required<number>();
	readonly ariaLabel = input<string>();

	protected readonly gaps = computed(() => Math.max(this.count() - 1, 1));

	protected readonly slots = computed<readonly StepSlot[]>(() =>
		Array.from({ length: this.count() }, (_value, index) => ({
			index,
			offset: (index / this.gaps()).toString(),
		})),
	);

	protected readonly position = computed(() =>
		((this.movedIndex() ?? this.index()) / this.gaps()).toString(),
	);

	protected readonly isTraveling = computed(() => 'idle' !== this.phase());

	private readonly movedIndex = signal<number | null>(null);

	private readonly phase = signal<TravelPhase>('idle');

	private readonly travel = new ScheduledAction();

	private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

	constructor() {
		let previous: number | null = null;

		effect(() => {
			const index = this.index();

			if (null !== previous && previous !== index) {
				this.depart();
			}

			previous = index;
		});

		inject(DestroyRef).onDestroy(() => {
			this.travel.cancel();
		});
	}

	private depart(): void {
		if (this.reducedMotion.matches) {
			this.travel.cancel();
			this.phase.set('idle');
			this.movedIndex.set(this.index());

			return;
		}

		if ('departing' === this.phase()) {
			return;
		}

		if ('moving' === this.phase()) {
			this.move();

			return;
		}

		this.phase.set('departing');

		this.travel.run(() => {
			this.move();
		}, RESIZE_DURATION_MS);
	}

	private move(): void {
		this.phase.set('moving');
		this.movedIndex.set(this.index());

		this.travel.run(() => {
			this.phase.set('idle');
		}, TRAVEL_DURATION_MS);
	}
}
