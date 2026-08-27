import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { Observable, shareReplay } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TranslocoLoaderService implements TranslocoLoader {
	private readonly http = inject(HttpClient);

	private readonly requests = new Map<string, Observable<Translation>>();

	getTranslation(path: string): Observable<Translation> {
		const pending = this.requests.get(path);

		if (undefined !== pending) {
			return pending;
		}

		const request = this.http
			.get<Translation>(`i18n/${path}.json`)
			.pipe(shareReplay({ bufferSize: 1, refCount: false }));

		this.requests.set(path, request);

		return request;
	}
}
