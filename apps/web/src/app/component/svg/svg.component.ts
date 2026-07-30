import { Component, computed, input } from '@angular/core';

import { Check } from '@app/util/check';

/** Intrinsic viewBox of each icon, keyed by its Font Awesome name. */
const ASPECT_RATIOS: Record<string, [number, number]> = {
	'backward-step': [320, 512],
	'chevron-left': [320, 512],
	'chevron-right': [320, 512],
	'forward-step': [320, 512],
	pause: [320, 512],

	ghost: [384, 512],
	play: [384, 512],
	stop: [384, 512],
	xmark: [384, 512],

	rabbit: [448, 512],
	trash: [448, 512],

	turtle: [512, 398],

	'delete-left': [576, 512],

	dice: [640, 512],
	'user-plus': [640, 512],
};

@Component({
	selector: 'app-svg',
	templateUrl: './svg.component.html',
	styleUrl: './svg.component.scss',
	host: {
		'[style.height]': 'size()',
		'[style.aspect-ratio]': 'squared() ? "1 / 1" : aspectRatio()',
	},
})
export class SvgComponent {
	readonly icon = input.required<string, string>({ transform: this.getIcon });
	readonly size = input<string, number>('24px', { transform: (size) => `${size.toString()}px` });
	readonly color = input<string>();
	readonly squared = input(false, { transform: Check.isFalseAsStringOrTrue });
	readonly flip = input(false, { transform: Check.isFalseAsStringOrTrue });

	private readonly aspectRatioTuple = computed<[number, number]>(() => this.getAspectRatio());
	readonly aspectRatio = computed(() => this.aspectRatioTuple().join(' / '));
	readonly aspectRatioValue = computed(
		() => this.aspectRatioTuple()[0] / this.aspectRatioTuple()[1],
	);

	readonly class = computed(() => {
		const color = this.color();
		const flip = this.flip();

		return (flip ? 'flip' : '') + (color !== undefined ? ` ${color}` : '');
	});

	getIcon(value: string): string {
		return `url(svg/${value}-solid.svg)`;
	}

	private getAspectRatio(): [number, number] {
		const icon = this.icon();
		const iconNameRegex = /svg\/(.+)-solid.svg/;
		const match = iconNameRegex.exec(icon);
		const iconName = match?.[1];

		return (undefined === iconName ? undefined : ASPECT_RATIOS[iconName]) ?? [1, 1];
	}
}
