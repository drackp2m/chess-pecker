import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from '@app/app.component';
import { appConfig } from '@app/app.config';
import { rewriteLegacyHashUrl } from '@app/util/legacy-hash-url';

rewriteLegacyHashUrl(location, history);

bootstrapApplication(AppComponent, appConfig).catch((error: unknown) => {
	console.error(error);
});
