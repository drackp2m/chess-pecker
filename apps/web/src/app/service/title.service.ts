import { Injectable, computed, signal } from '@angular/core';

@Injectable({
	providedIn: 'root',
})
export class TitleService {
	private readonly _title = signal('Chess Pecker');

	readonly title = computed(() => this._title());

	setTitle(title: string) {
		this._title.set('' !== title ? title : 'Chess Pecker');
	}
}
