import {
	ComponentRef,
	Directive,
	ElementRef,
	OnInit,
	Renderer2,
	ViewContainerRef,
	inject,
	input,
} from '@angular/core';

import { SvgComponent } from '@app/component/svg/svg.component';

type ButtonDirectiveType = 'button' | 'menu' | 'reset' | 'submit';
type ButtonDirectiveColor = 'primary' | 'primary-mid' | 'contrast' | 'contrast-mid' | 'accent';

@Directive({
	selector: 'button[appThemed]',
	host: {
		'[attr.type]': 'type()',
	},
})
export class ButtonDirective implements OnInit {
	readonly type = input<ButtonDirectiveType>('button');
	readonly color = input<ButtonDirectiveColor>('contrast-mid');
	readonly icon = input<string>();
	readonly iconSize = input<number>(24);

	private readonly elementRef = inject<ElementRef<HTMLButtonElement>>(ElementRef);
	private readonly renderer2 = inject(Renderer2);
	private readonly viewContainerRef = inject(ViewContainerRef);

	ngOnInit() {
		this.createWrapper();
	}

	private createWrapper() {
		const buttonElement = this.elementRef.nativeElement;
		const icon = this.icon();

		this.renderer2.addClass(buttonElement, 'app-button');

		if (icon === undefined) {
			this.addClassForTextButton(buttonElement);
		} else {
			this.renderer2.addClass(buttonElement, 'icon');
			const iconElement = this.createIcon(icon);
			this.renderer2.appendChild(buttonElement, iconElement.location.nativeElement);
		}
	}

	private addClassForTextButton(buttonElement: HTMLButtonElement): void {
		const color = this.color();

		this.renderer2.addClass(buttonElement, `surface-${color}`);
		this.renderer2.addClass(buttonElement, this.getContrastColor(color));
	}

	private getContrastColor(color: string): string {
		switch (color) {
			case 'primary':
			case 'primary-mid':
				return `color-contrast`;
			case 'contrast':
			case 'contrast-mid':
				return `color-primary`;
			case 'accent':
			default:
				return 'color-primary-light';
		}
	}

	private createIcon(icon: string): ComponentRef<SvgComponent> {
		const iconSize = this.iconSize();

		const iconElement = this.viewContainerRef.createComponent(SvgComponent);

		iconElement.setInput('icon', icon);
		iconElement.setInput('size', iconSize);

		return iconElement;
	}
}
