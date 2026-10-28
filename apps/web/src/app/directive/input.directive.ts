import { Directive, input } from '@angular/core';

import { ThemedFieldDirective } from '@app/directive/field/themed-field.directive';

type InputDirectiveType =
	'date' | 'email' | 'number' | 'password' | 'search' | 'tel' | 'text' | 'url';

const selector =
	'input[appThemed][type=date],' +
	'input[appThemed][type=email],' +
	'input[appThemed][type=number],' +
	'input[appThemed][type=password],' +
	'input[appThemed][type=search],' +
	'input[appThemed][type=tel],' +
	'input[appThemed][type=text],' +
	'input[appThemed][type=url]';

@Directive({
	selector,
})
export class InputDirective extends ThemedFieldDirective<HTMLInputElement> {
	readonly type = input.required<InputDirectiveType>();

	protected readonly wrapperClass = 'app-input';

	protected override isFilled(control: HTMLInputElement): boolean {
		return 'date' === this.type() || super.isFilled(control);
	}
}
