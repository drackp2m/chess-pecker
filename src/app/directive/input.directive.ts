import {
	AfterViewInit,
	DestroyRef,
	Directive,
	ElementRef,
	HostListener,
	OnInit,
	Renderer2,
	effect,
	inject,
	input,
} from '@angular/core';

import { createTypedElement } from '@app/util/renderer';

type InputDirectiveType = 'email' | 'number' | 'password' | 'search' | 'tel' | 'text' | 'url';
let nextInputId = 0;

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
export class InputDirective implements OnInit, AfterViewInit {
	// FixMe => input are not filled when write text on type number
	readonly type = input.required<InputDirectiveType>();
	readonly label = input('');
	readonly placeholder = input('');

	private readonly elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
	private readonly renderer2 = inject(Renderer2);
	private readonly destroyRef = inject(DestroyRef);

	private readonly wrapperElement: HTMLDivElement = this.createWrapper();
	private readonly labelSpanElement: HTMLSpanElement = this.createLabelMeasure();
	private readonly labelElement: HTMLLabelElement = this.createLabel();
	private readonly fakeLabelElement: HTMLSpanElement = this.createFakeLabel();
	private readonly borderContainerElement: HTMLDivElement = this.createBorderContainer();

	constructor() {
		effect(() => {
			const label = this.label();
			this.fillLabel(label);
		});
		effect(() => {
			const placeholder = this.placeholder();
			this.fillPlaceholder(placeholder);
		});
	}

	@HostListener('focus')
	onFocus() {
		this.renderer2.addClass(this.wrapperElement, 'focused');
	}

	@HostListener('blur')
	onBlur() {
		this.renderer2.removeClass(this.wrapperElement, 'focused');
	}

	@HostListener('input')
	@HostListener('change')
	onInput() {
		const value = this.elementRef.nativeElement.value;

		if ('' === value) {
			this.renderer2.removeClass(this.wrapperElement, 'filled');
		} else {
			this.renderer2.addClass(this.wrapperElement, 'filled');
		}
	}

	ngOnInit() {
		this.ensureId();
		this.prepareWrapper();
	}

	ngAfterViewInit() {
		this.observeSizeChanges();
		this.observeDisabledChanges();
		this.onInput();
	}

	/**
	 * Same rationale as the select shell: the label width is not static
	 * (async translations, runtime language changes, late-loading web fonts),
	 * so the hidden measure span and the wrapper are re-measured on every
	 * size change — including the initial layout, since observers fire once
	 * on `observe()`.
	 */
	private observeSizeChanges(): void {
		const observer = new ResizeObserver(() => {
			this.applySizeVariables();
		});

		observer.observe(this.labelSpanElement);
		observer.observe(this.wrapperElement);

		this.destroyRef.onDestroy(() => {
			observer.disconnect();
		});
	}

	private applySizeVariables(): void {
		this.setCSSVariable('--label-width', `${this.labelSpanElement.offsetWidth.toString()}px`);
		this.setCSSVariable('--input-height', `${this.wrapperElement.offsetHeight.toString()}px`);
	}

	/**
	 * The `disabled` attribute lives on the native input (reactive forms,
	 * `[disabled]` bindings), but the themed styles hang off the wrapper the
	 * directive builds around it, so attribute changes are mirrored as a
	 * `.disabled` class.
	 */
	private observeDisabledChanges(): void {
		const observer = new MutationObserver(() => {
			this.syncDisabled();
		});

		observer.observe(this.elementRef.nativeElement, {
			attributes: true,
			attributeFilter: ['disabled'],
		});

		this.syncDisabled();

		this.destroyRef.onDestroy(() => {
			observer.disconnect();
		});
	}

	private syncDisabled(): void {
		if (this.elementRef.nativeElement.disabled) {
			this.renderer2.addClass(this.wrapperElement, 'disabled');
		} else {
			this.renderer2.removeClass(this.wrapperElement, 'disabled');
		}
	}

	// Same mechanism as the select shell: keep any id provided by the
	// consumer, otherwise generate one so the label can point at the input
	// explicitly (on top of the implicit wrapping association).
	private ensureId(): void {
		const inputElement = this.elementRef.nativeElement;

		if ('' === inputElement.id) {
			this.renderer2.setAttribute(inputElement, 'id', `app-input-${(nextInputId++).toString()}`);
		}

		this.renderer2.setAttribute(this.labelElement, 'for', inputElement.id);
	}

	private setCSSVariable(name: string, value: string) {
		this.wrapperElement.style.setProperty(name, value);
	}

	private prepareWrapper() {
		const inputElement = this.elementRef.nativeElement;
		const nextSibling = inputElement.nextSibling;
		const parentElement = inputElement.parentNode;

		this.renderer2.addClass(inputElement, 'br-2');

		this.renderer2.removeChild(parentElement, inputElement);
		this.renderer2.appendChild(this.labelElement, inputElement);
		this.renderer2.appendChild(this.wrapperElement, this.labelElement);
		this.renderer2.appendChild(this.wrapperElement, this.borderContainerElement);
		this.renderer2.appendChild(this.wrapperElement, this.fakeLabelElement);

		if (null !== nextSibling) {
			this.renderer2.insertBefore(parentElement, this.wrapperElement, nextSibling);
		} else {
			this.renderer2.appendChild(parentElement, this.wrapperElement);
		}
	}

	private createWrapper(): HTMLDivElement {
		const element = createTypedElement(this.renderer2, 'div');

		this.renderer2.addClass(element, 'app-input');

		return element;
	}

	// The measure span lives inside the real label (which wraps the input),
	// so the label keeps its text content while the visible floating label
	// is the sibling `.label` element.
	private createLabel(): HTMLLabelElement {
		const element = createTypedElement(this.renderer2, 'label');
		this.renderer2.appendChild(element, this.labelSpanElement);

		return element;
	}

	private createLabelMeasure(): HTMLSpanElement {
		const element = createTypedElement(this.renderer2, 'span');

		this.renderer2.addClass(element, 'label-measure');

		return element;
	}

	private createFakeLabel(): HTMLSpanElement {
		const element = createTypedElement(this.renderer2, 'p') as HTMLSpanElement;

		this.renderer2.addClass(element, 'label');
		this.renderer2.setAttribute(element, 'aria-hidden', 'true');

		return element;
	}

	private createBorderContainer(): HTMLDivElement {
		const element = createTypedElement(this.renderer2, 'div');

		this.renderer2.addClass(element, 'border-container');
		this.renderer2.addClass(element, 'flex-row');
		this.renderer2.setAttribute(element, 'aria-hidden', 'true');

		return element;
	}

	// The visual label copies are decorative (aria-hidden / visibility:
	// hidden), so the accessible name is set explicitly on the input.
	private fillLabel(value: string): void {
		this.renderer2.setProperty(this.labelSpanElement, 'textContent', value);
		this.renderer2.setProperty(this.fakeLabelElement, 'textContent', value);
		this.renderer2.setAttribute(this.elementRef.nativeElement, 'aria-label', value);
	}

	private fillPlaceholder(value: string): void {
		this.renderer2.setAttribute(this.elementRef.nativeElement, 'placeholder', value);
	}
}
