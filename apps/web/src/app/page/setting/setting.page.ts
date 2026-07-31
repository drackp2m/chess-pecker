import { Component, Signal, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import {
	MOVE_ANIMATIONS,
	MOVE_ANIMATION_LABEL,
	MoveAnimation,
} from '@app/definition/board-animation.type';
import { MOVE_INPUT_LABEL, buildMoveInputMethods } from '@app/definition/board-input.type';
import { MISTAKE_POLICY_LABEL } from '@app/definition/mistake-policy.type';
import { Theme } from '@app/definition/service/theme.type';
import { RadioCheckboxDirective } from '@app/directive/radio-checkbox/radio-checkbox.directive';
import { version } from '@app/package';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { MistakePolicyService } from '@app/service/mistake-policy.service';
import { SoundService } from '@app/service/sound.service';
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
	readonly inputLabel = MOVE_INPUT_LABEL;
	readonly mistakeLabel = MISTAKE_POLICY_LABEL;

	private readonly themeService = inject(ThemeService);
	private readonly boardPreference = inject(BoardPreferenceService);
	private readonly mistakePolicy = inject(MistakePolicyService);
	private readonly sound = inject(SoundService);
	private readonly router = inject(Router);

	private firstChangeIgnored = false;
	private firstAnimationChangeIgnored = false;
	private firstInputChangeIgnored = false;
	private firstMistakeChangeIgnored = false;
	private firstSoundChangeIgnored = false;

	readonly form = new FormGroup({
		appearance: new FormControl<Theme | 'system'>(this.themeService.selectedTheme(), {
			nonNullable: true,
			validators: [Validators.required],
		}),
		moveAnimation: new FormControl<MoveAnimation>(this.boardPreference.moveAnimation(), {
			nonNullable: true,
			validators: [Validators.required],
		}),
		clickToMove: new FormControl<boolean>(this.isMethodEnabled('click'), { nonNullable: true }),
		dragToMove: new FormControl<boolean>(this.isMethodEnabled('drag'), { nonNullable: true }),
		sound: new FormControl<boolean>(this.sound.isEnabled(), { nonNullable: true }),
		mistake: new FormGroup({
			undoMistake: new FormControl<boolean>(this.mistakePolicy.policy().undoMistake, {
				nonNullable: true,
			}),
			freePlay: new FormControl<boolean>(this.mistakePolicy.policy().freePlay, {
				nonNullable: true,
			}),
			retry: new FormControl<boolean>(this.mistakePolicy.policy().retry, { nonNullable: true }),
			showSolution: new FormControl<boolean>(this.mistakePolicy.policy().showSolution, {
				nonNullable: true,
			}),
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

	private readonly clickToMoveChange: Signal<boolean> = toSignal(
		this.form.controls.clickToMove.valueChanges,
		{ initialValue: this.isMethodEnabled('click') },
	);

	private readonly dragToMoveChange: Signal<boolean> = toSignal(
		this.form.controls.dragToMove.valueChanges,
		{ initialValue: this.isMethodEnabled('drag') },
	);

	private readonly soundChange: Signal<boolean> = toSignal(this.form.controls.sound.valueChanges, {
		initialValue: this.sound.isEnabled(),
	});

	private readonly mistakeChange = toSignal(this.form.controls.mistake.valueChanges, {
		initialValue: this.mistakePolicy.policy(),
	});

	constructor() {
		this.syncAppearance();
		this.syncMoveAnimation();
		this.syncMoveInput();
		this.syncSound();
		this.syncMistakePolicy();
	}

	private syncAppearance(): void {
		effect(() => {
			this.form.controls.appearance.setValue(this.themeService.selectedTheme(), {
				emitEvent: false,
			});
		});

		effect(() => {
			const newTheme = this.appearanceChange();

			if (this.firstChangeIgnored) {
				this.themeService.updateSelectedTheme(newTheme);
			} else {
				this.firstChangeIgnored = true;
			}
		});
	}

	private syncMoveAnimation(): void {
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

	private syncMoveInput(): void {
		// Mirrors both the stored value and the correction made when a selection
		// would otherwise leave the board with no way to move a piece.
		effect(() => {
			this.form.controls.clickToMove.setValue(this.isMethodEnabled('click'), {
				emitEvent: false,
			});
			this.form.controls.dragToMove.setValue(this.isMethodEnabled('drag'), { emitEvent: false });
		});

		effect(() => {
			const methods = buildMoveInputMethods(this.clickToMoveChange(), this.dragToMoveChange());

			if (this.firstInputChangeIgnored) {
				this.boardPreference.updateMoveInputMethods(methods);
			} else {
				this.firstInputChangeIgnored = true;
			}
		});
	}

	private syncSound(): void {
		effect(() => {
			this.form.controls.sound.setValue(this.sound.isEnabled(), { emitEvent: false });
		});

		effect(() => {
			const isEnabled = this.soundChange();

			if (this.firstSoundChangeIgnored) {
				this.sound.update(isEnabled);
			} else {
				this.firstSoundChangeIgnored = true;
			}
		});
	}

	private syncMistakePolicy(): void {
		effect(() => {
			this.form.controls.mistake.setValue(this.mistakePolicy.policy(), { emitEvent: false });
		});

		effect(() => {
			this.mistakeChange();

			if (this.firstMistakeChangeIgnored) {
				this.mistakePolicy.update(this.form.controls.mistake.getRawValue());
			} else {
				this.firstMistakeChangeIgnored = true;
			}
		});
	}

	private isMethodEnabled(method: 'click' | 'drag'): boolean {
		return this.boardPreference.moveInputMethods().includes(method);
	}
}
