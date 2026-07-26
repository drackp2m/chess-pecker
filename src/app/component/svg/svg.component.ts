import { Component, computed, input } from '@angular/core';

import { Check } from '@app/util/check';

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

		switch (iconName) {
			case 'backward-step':
			case 'chevron-left':
			case 'chevron-right':
			case 'forward-step':
			case 'pause':
				return [320, 512];

			case 'ghost':
			case 'play':
			case 'stop':
			case 'xmark':
				return [384, 512];

			case 'rabbit':
			case 'trash':
				return [448, 512];

			case 'turtle':
				return [512, 398];

			case 'delete-left':
				return [576, 512];

			case 'dice':
			case 'user-plus':
				return [640, 512];

			default:
				return [1, 1];
		}
	}
}
