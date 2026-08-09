import { Injectable, computed, signal } from '@angular/core';

@Injectable({
	providedIn: 'root',
})
export class TitleService {
	private readonly _titleKey = signal('');

	readonly titleKey = computed(() => this._titleKey());

	setTitleKey(key: string) {
		this._titleKey.set(key);
	}
}
