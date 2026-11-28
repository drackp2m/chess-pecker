import { Injectable, computed, signal } from '@angular/core';

@Injectable({
	providedIn: 'root',
})
export class HeaderService {
	private readonly _titleKey = signal('');
	private readonly _backLink = signal<string | null>(null);

	readonly titleKey = computed(() => this._titleKey());
	readonly backLink = computed(() => this._backLink());

	setTitleKey(key: string) {
		this._titleKey.set(key);
	}

	setBackLink(link: string | null) {
		this._backLink.set(link);
	}
}
