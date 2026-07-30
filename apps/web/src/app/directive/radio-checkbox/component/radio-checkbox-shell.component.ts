import { NgTemplateOutlet } from '@angular/common';
import { Component, TemplateRef, input } from '@angular/core';

export interface RadioCheckboxShellViewModel {
	type: string;
	inputId: string;
	bare: boolean;
	selected: boolean;
	focused: boolean;
	labelText: string | undefined;
	labelTemplate: TemplateRef<void> | undefined;
}

@Component({
	selector: 'app-radio-checkbox-shell',
	templateUrl: './radio-checkbox-shell.component.html',
	imports: [NgTemplateOutlet],
})
export class RadioCheckboxShellComponent {
	readonly viewModel = input.required<RadioCheckboxShellViewModel>();
}
