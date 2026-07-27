import { Injectable, computed, signal } from '@angular/core';

@Injectable({
	providedIn: 'root',
})
// FixMe => "Round Timer" is the previous project's name and it is what the header
// actually renders: no route sets a title through this service, so every screen shows
// it. `TemplatePageTitleStrategy` sets `document.title` from the route and never
// touches `TitleService`, which is the wiring this was meant to have.
export class TitleService {
	private readonly _title = signal('Round Timer');

	readonly title = computed(() => this._title());

	setTitle(title: string) {
		this._title.set('' !== title ? title : 'Round Timer');
	}
}
