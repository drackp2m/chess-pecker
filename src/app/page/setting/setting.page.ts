import { Component, Signal, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import {
	MOVE_ANIMATIONS,
	MOVE_ANIMATION_LABEL,
	MoveAnimation,
} from '@app/definition/board-animation.type';
import { Theme } from '@app/definition/service/theme.type';
import { RadioCheckboxDirective } from '@app/directive/radio-checkbox/radio-checkbox.directive';
import { version } from '@app/package';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { ThemeService } from '@app/service/theme.service';

@Component({
	templateUrl: './setting.page.html',
	styleUrl: './setting.page.scss',
	imports: [ReactiveFormsModule, RadioCheckboxDirective],
	providers: [],
})
export class SettingPage {
	readonly VERSION = version;

	readonly moveAnimations = MOVE_ANIMATIONS;
	readonly animationLabel = MOVE_ANIMATION_LABEL;

	private readonly themeService = inject(ThemeService);
	private readonly boardPreference = inject(BoardPreferenceService);
	private readonly router = inject(Router);

	private firstChangeIgnored = false;
	private firstAnimationChangeIgnored = false;

	readonly form = new FormGroup({
		appearance: new FormControl<Theme | 'system'>(this.themeService.selectedTheme(), {
			nonNullable: true,
			validators: [Validators.required],
		}),
		moveAnimation: new FormControl<MoveAnimation>(this.boardPreference.moveAnimation(), {
			nonNullable: true,
			validators: [Validators.required],
		}),
	});

	private readonly appearanceChange: Signal<Theme | 'system'> = toSignal(
		this.form.controls.appearance.valueChanges,
		{ initialValue: this.themeService.selectedTheme() },
	);

	private readonly moveAnimationChange: Signal<MoveAnimation> = toSignal(
		this.form.controls.moveAnimation.valueChanges,
		{ initialValue: this.boardPreference.moveAnimation() },
	);

	constructor() {
		effect(() => {
			const newTheme = this.appearanceChange();

			if (this.firstChangeIgnored) {
				this.themeService.updateSelectedTheme(newTheme);
			} else {
				this.firstChangeIgnored = true;
			}
		});

		// The stored preference arrives after the form is built, so mirror it back in.
		effect(() => {
			this.form.controls.moveAnimation.setValue(this.boardPreference.moveAnimation(), {
				emitEvent: false,
			});
		});

		effect(() => {
			const animation = this.moveAnimationChange();

			if (this.firstAnimationChangeIgnored) {
				this.boardPreference.updateMoveAnimation(animation);
			} else {
				this.firstAnimationChangeIgnored = true;
			}
		});
	}
}
