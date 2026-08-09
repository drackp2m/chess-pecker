import { Directive, ElementRef, afterRenderEffect, inject, input } from '@angular/core';

@Directive({
	selector: '[appPinScrollEnd]',
})
export class PinScrollEndDirective {
	readonly appPinScrollEnd = input<unknown>();

	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

	constructor() {
		afterRenderEffect({
			write: () => {
				this.appPinScrollEnd();

				const element = this.host.nativeElement;

				element.scrollLeft = element.scrollWidth;
			},
		});
	}
}
