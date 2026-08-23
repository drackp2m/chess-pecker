import { Component, input } from '@angular/core';

export interface SegmentShellViewModel {
	controlId: string;
	label: string;
	selected: boolean;
	disabled: boolean;
	focused: boolean;
}

@Component({
	selector: 'app-segment-shell',
	templateUrl: './segment-shell.component.html',
	styleUrl: './segment-shell.component.scss',
	host: {
		'[class.is-selected]': 'viewModel().selected',
		'[class.is-disabled]': 'viewModel().disabled',
		'[class.is-focused]': 'viewModel().focused',
	},
})
export class SegmentShellComponent {
	readonly viewModel = input.required<SegmentShellViewModel>();
}
