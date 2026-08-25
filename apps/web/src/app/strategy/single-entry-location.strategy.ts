import { HashLocationStrategy } from '@angular/common';
import { Injectable } from '@angular/core';

@Injectable()
export class SingleEntryLocationStrategy extends HashLocationStrategy {
	override pushState(state: unknown, title: string, path: string, queryParams: string): void {
		super.replaceState(state, title, path, queryParams);
	}
}
