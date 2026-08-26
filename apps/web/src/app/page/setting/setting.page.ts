import { Component, computed, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { BoardDemoComponent } from '@app/component/board-demo/board-demo.component';
import { SyncStatusComponent } from '@app/component/sync-status/sync-status.component';
import {
	MOVE_ANIMATIONS,
	MOVE_ANIMATION_LABEL,
	MoveAnimation,
} from '@app/definition/board-animation.type';
import { MOVE_INPUT_LABEL, buildMoveInputMethods } from '@app/definition/board-input.type';
import { LANGUAGES, LANGUAGE_FLAG, LANGUAGE_NAME, Language } from '@app/definition/language.type';
import { MOVE_SPEEDS, MOVE_SPEED_LABEL, MoveSpeed } from '@app/definition/move-speed.type';
import { Theme } from '@app/definition/service/theme.type';
import { RadioCheckboxDirective } from '@app/directive/radio-checkbox/radio-checkbox.directive';
import { I18n, provideI18nScope } from '@app/i18n';
import { version } from '@app/package';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { LanguageService } from '@app/service/language.service';
import { SoundService } from '@app/service/sound.service';
import { ThemeService } from '@app/service/theme.service';
import { bindSetting } from '@app/util/setting-binding';

@Component({
	templateUrl: './setting.page.html',
	styleUrl: './setting.page.scss',
	imports: [
		ReactiveFormsModule,
		RadioCheckboxDirective,
		BoardDemoComponent,
		SyncStatusComponent,
		I18nPipe,
	],
	providers: [provideI18nScope('setting')],
})
export class SettingPage {
	protected readonly I18n = I18n;

	readonly VERSION = version;

	readonly moveSpeeds = MOVE_SPEEDS;
	readonly speedLabel = MOVE_SPEED_LABEL;
	readonly moveAnimations = MOVE_ANIMATIONS;
	readonly animationLabel = MOVE_ANIMATION_LABEL;
	readonly inputLabel = MOVE_INPUT_LABEL;
	readonly languages = LANGUAGES;
	readonly languageName = LANGUAGE_NAME;
	readonly languageFlag = LANGUAGE_FLAG;

	private readonly themeService = inject(ThemeService);
	private readonly boardPreference = inject(BoardPreferenceService);
	private readonly sound = inject(SoundService);
	private readonly languageService = inject(LanguageService);

	readonly form = new FormGroup({
		language: new FormControl<Language>(this.languageService.selectedLanguage(), {
			nonNullable: true,
			validators: [Validators.required],
		}),
		appearance: new FormControl<Theme | 'system'>(this.themeService.selectedTheme(), {
			nonNullable: true,
			validators: [Validators.required],
		}),
		moveSpeed: new FormControl<MoveSpeed>(this.boardPreference.moveSpeed(), {
			nonNullable: true,
			validators: [Validators.required],
		}),
		moveAnimation: new FormControl<MoveAnimation>(this.boardPreference.moveAnimation(), {
			nonNullable: true,
			validators: [Validators.required],
		}),
		moveInput: new FormGroup({
			click: new FormControl<boolean>(this.isMethodEnabled('click'), { nonNullable: true }),
			drag: new FormControl<boolean>(this.isMethodEnabled('drag'), { nonNullable: true }),
		}),
		moveLift: new FormControl<boolean>(this.boardPreference.moveLift(), { nonNullable: true }),
		sound: new FormControl<boolean>(this.sound.isEnabled(), { nonNullable: true }),
	});

	// Mirrors both the stored value and the correction made when a selection would
	// otherwise leave the board with no way to move a piece.
	private readonly moveInput = computed(() => ({
		click: this.isMethodEnabled('click'),
		drag: this.isMethodEnabled('drag'),
	}));

	constructor() {
		bindSetting(this.form.controls.language, this.languageService.selectedLanguage, (language) => {
			void this.languageService.updateSelectedLanguage(language);
		});

		bindSetting(this.form.controls.appearance, this.themeService.selectedTheme, (theme) => {
			this.themeService.updateSelectedTheme(theme);
		});

		bindSetting(this.form.controls.moveSpeed, this.boardPreference.moveSpeed, (speed) => {
			this.boardPreference.updateMoveSpeed(speed);
		});

		bindSetting(
			this.form.controls.moveAnimation,
			this.boardPreference.moveAnimation,
			(animation) => {
				this.boardPreference.updateMoveAnimation(animation);
			},
		);

		bindSetting(this.form.controls.moveInput, this.moveInput, ({ click, drag }) => {
			this.boardPreference.updateMoveInputMethods(buildMoveInputMethods(click, drag));
		});

		bindSetting(this.form.controls.moveLift, this.boardPreference.moveLift, (isEnabled) => {
			this.boardPreference.updateMoveLift(isEnabled);
		});

		bindSetting(this.form.controls.sound, this.sound.isEnabled, (isEnabled) => {
			this.sound.update(isEnabled);
		});
	}

	private isMethodEnabled(method: 'click' | 'drag'): boolean {
		return this.boardPreference.moveInputMethods().includes(method);
	}
}
