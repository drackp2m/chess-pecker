import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TranslocoLoaderService implements TranslocoLoader {
	private readonly http = inject(HttpClient);

	getTranslation(path: string): Observable<Translation> {
		return this.http.get<Translation>(`i18n/${path}.json`);
	}
}
