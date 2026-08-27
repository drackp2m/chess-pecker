import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { Observable, ReplaySubject, share } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TranslocoLoaderService implements TranslocoLoader {
	private readonly http = inject(HttpClient);

	private readonly requests = new Map<string, Observable<Translation>>();

	getTranslation(path: string): Observable<Translation> {
		const pending = this.requests.get(path);

		if (undefined !== pending) {
			return pending;
		}

		const request = this.http.get<Translation>(`i18n/${path}.json`).pipe(
			share({
				connector: () => new ReplaySubject<Translation>(1),
				resetOnError: true,
				resetOnComplete: false,
				resetOnRefCountZero: false,
			}),
		);

		this.requests.set(path, request);

		return request;
	}
}
