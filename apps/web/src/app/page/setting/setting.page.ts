import { Component, computed, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { SyncStatusComponent } from '@app/component/sync-status/sync-status.component';
import {
	LANGUAGE_FLAG,
	LANGUAGE_NAME,
	Language,
	SELECTABLE_LANGUAGES,
} from '@app/definition/language.type';
import { GENDERS, GENDER_LABEL, Gender } from '@app/definition/model/setting/gender.type';
import { Theme } from '@app/definition/service/theme.type';
import { ButtonDirective } from '@app/directive/button.directive';
import { RadioCheckboxDirective } from '@app/directive/radio-checkbox/radio-checkbox.directive';
import { RouterLinkDirective } from '@app/directive/router-link.directive';
import { SelectDirective } from '@app/directive/select/select.directive';
import { I18n, provideI18nScope } from '@app/i18n';
import { version } from '@app/package';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { BookmarkPreferenceService } from '@app/service/bookmark-preference.service';
import { GenderService } from '@app/service/gender.service';
import { LanguageService } from '@app/service/language.service';
import { ThemeService } from '@app/service/theme.service';
import { TIMEZONES, TimezoneService } from '@app/service/timezone.service';
import { bindSetting } from '@app/util/setting-binding';

@Component({
	templateUrl: './setting.page.html',
	styleUrl: './setting.page.scss',
	imports: [
		ReactiveFormsModule,
		RadioCheckboxDirective,
		SelectDirective,
		ButtonDirective,
		RouterLinkDirective,
		SyncStatusComponent,
		I18nPipe,
	],
	providers: [provideI18nScope('setting')],
})
export class SettingPage {
	protected readonly I18n = I18n;

	readonly VERSION = version;

	readonly languages = SELECTABLE_LANGUAGES;
	readonly timezones = TIMEZONES;
	readonly languageName = LANGUAGE_NAME;
	readonly languageFlag = LANGUAGE_FLAG;
	readonly genders = GENDERS;
	readonly genderLabel = GENDER_LABEL;

	private readonly themeService = inject(ThemeService);
	private readonly bookmarkPreference = inject(BookmarkPreferenceService);
	private readonly languageService = inject(LanguageService);
	private readonly timezoneService = inject(TimezoneService);
	private readonly genderService = inject(GenderService);

	private readonly isBookmarkAlwaysFavorite = computed(
		() => !this.bookmarkPreference.isPromptEnabled(),
	);

	readonly form = new FormGroup({
		language: new FormControl<Language>(this.languageService.selectedLanguage(), {
			nonNullable: true,
			validators: [Validators.required],
		}),
		timezone: new FormControl<string>(this.timezoneService.selectedTimezone(), {
			nonNullable: true,
			validators: [Validators.required],
		}),
		gender: new FormControl<Gender>(this.genderService.selectedGender(), {
			nonNullable: true,
			validators: [Validators.required],
		}),
		appearance: new FormControl<Theme | 'system'>(this.themeService.selectedTheme(), {
			nonNullable: true,
			validators: [Validators.required],
		}),
		bookmarkAlwaysFavorite: new FormControl<boolean>(this.isBookmarkAlwaysFavorite(), {
			nonNullable: true,
		}),
	});

	constructor() {
		this.bindApp();
	}

	private bindApp(): void {
		bindSetting(this.form.controls.language, this.languageService.selectedLanguage, (language) => {
			void this.languageService.updateSelectedLanguage(language);
		});

		bindSetting(this.form.controls.timezone, this.timezoneService.selectedTimezone, (timezone) => {
			this.timezoneService.updateSelectedTimezone(timezone);
		});

		bindSetting(this.form.controls.gender, this.genderService.selectedGender, (gender) => {
			this.genderService.updateSelectedGender(gender);
		});

		bindSetting(this.form.controls.appearance, this.themeService.selectedTheme, (theme) => {
			this.themeService.updateSelectedTheme(theme);
		});

		bindSetting(
			this.form.controls.bookmarkAlwaysFavorite,
			this.isBookmarkAlwaysFavorite,
			(isAlways) => {
				this.bookmarkPreference.updatePrompt(!isAlways);
			},
		);
	}
}
