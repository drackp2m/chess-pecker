import { TestBed } from '@angular/core/testing';

import { AppComponent } from '@app/app.component';
import { provideTestingI18n } from '@app/testing/i18n.harness';

describe('AppComponent', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [AppComponent],
			providers: [provideTestingI18n()],
		}).compileComponents();
	});

	it('should create the app', () => {
		const fixture = TestBed.createComponent(AppComponent);
		expect(fixture.componentInstance).toBeTruthy();
	});

	it(`should have the 'chesspecker' title`, () => {
		const fixture = TestBed.createComponent(AppComponent);
		expect(fixture.componentInstance.title).toBe('chesspecker');
	});
});
