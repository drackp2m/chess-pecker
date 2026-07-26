import { Injectable, computed, signal } from '@angular/core';

@Injectable({
	providedIn: 'root',
})
export class TitleService {
	private readonly _title = signal('Round Timer');

	readonly title = computed(() => this._title());

	setTitle(title: string) {
		this._title.set('' !== title ? title : 'Round Timer');
	}
}
