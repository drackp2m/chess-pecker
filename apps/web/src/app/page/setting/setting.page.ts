import { Component, computed, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { BoardDemoComponent } from '@app/component/board-demo/board-demo.component';
import {
	MOVE_ANIMATIONS,
	MOVE_ANIMATION_LABEL,
	MoveAnimation,
} from '@app/definition/board-animation.type';
import { MOVE_INPUT_LABEL, buildMoveInputMethods } from '@app/definition/board-input.type';
import { MISTAKE_THRESHOLD_OPTIONS } from '@app/definition/mistake-policy.type';
import { MOVE_SPEEDS, MOVE_SPEED_LABEL, MoveSpeed } from '@app/definition/move-speed.type';
import { Theme } from '@app/definition/service/theme.type';
import { RadioCheckboxDirective } from '@app/directive/radio-checkbox/radio-checkbox.directive';
import { version } from '@app/package';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { MistakePolicyService } from '@app/service/mistake-policy.service';
import { SoundService } from '@app/service/sound.service';
import { ThemeService } from '@app/service/theme.service';
import { bindSetting } from '@app/util/setting-binding';

@Component({
	templateUrl: './setting.page.html',
	styleUrl: './setting.page.scss',
	imports: [ReactiveFormsModule, RadioCheckboxDirective, BoardDemoComponent],
	providers: [],
})
export class SettingPage {
	readonly VERSION = version;

	readonly moveSpeeds = MOVE_SPEEDS;
	readonly speedLabel = MOVE_SPEED_LABEL;
	readonly moveAnimations = MOVE_ANIMATIONS;
	readonly animationLabel = MOVE_ANIMATION_LABEL;
	readonly inputLabel = MOVE_INPUT_LABEL;
	readonly mistakeOptions = MISTAKE_THRESHOLD_OPTIONS;

	private readonly themeService = inject(ThemeService);
	private readonly boardPreference = inject(BoardPreferenceService);
	private readonly mistakePolicy = inject(MistakePolicyService);
	private readonly sound = inject(SoundService);

	readonly form = new FormGroup({
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
		sound: new FormControl<boolean>(this.sound.isEnabled(), { nonNullable: true }),
		mistake: new FormGroup({
			mistakesBeforeSolution: new FormControl<number>(
				this.mistakePolicy.policy().mistakesBeforeSolution,
				{ nonNullable: true },
			),
		}),
	});

	// Mirrors both the stored value and the correction made when a selection would
	// otherwise leave the board with no way to move a piece.
	private readonly moveInput = computed(() => ({
		click: this.isMethodEnabled('click'),
		drag: this.isMethodEnabled('drag'),
	}));

	constructor() {
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

		bindSetting(this.form.controls.sound, this.sound.isEnabled, (isEnabled) => {
			this.sound.update(isEnabled);
		});

		bindSetting(this.form.controls.mistake, this.mistakePolicy.policy, (policy) => {
			this.mistakePolicy.update(policy);
		});
	}

	private isMethodEnabled(method: 'click' | 'drag'): boolean {
		return this.boardPreference.moveInputMethods().includes(method);
	}
}
