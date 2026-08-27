import { Component, computed, input } from '@angular/core';

import { Check } from '@app/util/check';

const ASPECT_RATIOS: [[number, number], string[]][] = [
	[
		[320, 512],
		['backward-step', 'chevron-left', 'chevron-right', 'forward-step', 'pause'],
	],
	[
		[384, 512],
		['bookmark', 'ghost', 'play', 'stop', 'xmark'],
	],
	[
		[448, 512],
		['chess-board', 'flag', 'flag-hollow', 'rabbit', 'share-nodes', 'trash'],
	],
	[[512, 255], ['flashlight']],
	[[512, 398], ['turtle']],
	[
		[576, 512],
		['delete-left', 'map-location-dot.svg'],
	],
	[
		[640, 512],
		['cloud', 'cloud-hollow', 'cloud-arrow-down', 'cloud-arrow-up', 'dice', 'user-plus'],
	],
];

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
		return `url(svg/icon/${value}.svg)`;
	}

	private getAspectRatio(): [number, number] {
		const icon = this.icon();
		const iconNameRegex = /svg\/icon\/(.+)\.svg/;
		const match = iconNameRegex.exec(icon);
		const iconName = match?.[1];

		if (undefined === iconName) {
			return [1, 1];
		}

		return ASPECT_RATIOS.find(([, icons]) => icons.includes(iconName))?.[0] ?? [1, 1];
	}
}
