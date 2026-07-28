import { Renderer2 } from '@angular/core';

export function createTypedElement<K extends keyof HTMLElementTagNameMap>(
	renderer: Renderer2,
	tag: K,
): HTMLElementTagNameMap[K] {
	return renderer.createElement(tag) as HTMLElementTagNameMap[K];
}
