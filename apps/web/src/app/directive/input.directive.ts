import { Directive, input } from '@angular/core';

import { ThemedFieldDirective } from '@app/directive/field/themed-field.directive';

// ToDo => no `date`, so a training goal cannot use the end date the API accepts: the
// floating label would have to account for the native picker, which is always filled.
type InputDirectiveType = 'email' | 'number' | 'password' | 'search' | 'tel' | 'text' | 'url';

const selector =
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
}
