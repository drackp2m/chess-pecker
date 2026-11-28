import { PathLocationStrategy } from '@angular/common';
import { Injectable } from '@angular/core';

@Injectable()
export class SingleEntryLocationStrategy extends PathLocationStrategy {
	override pushState(state: unknown, title: string, path: string, queryParams: string): void {
		super.replaceState(state, title, path, queryParams);
	}
}
