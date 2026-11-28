import { Component, computed, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { BoardDemoComponent } from '@app/component/board-demo/board-demo.component';
import { ANALYSIS_DEPTHS, normalizeAnalysisDepth } from '@app/definition/analysis-preference.type';
import {
	MOVE_ANIMATIONS,
	MOVE_ANIMATION_LABEL,
	MoveAnimation,
} from '@app/definition/board-animation.type';
import { MOVE_INPUT_LABEL, buildMoveInputMethods } from '@app/definition/board-input.type';
import { MOVE_SPEEDS, MOVE_SPEED_LABEL, MoveSpeed } from '@app/definition/move-speed.type';
import { RadioCheckboxDirective } from '@app/directive/radio-checkbox/radio-checkbox.directive';
import { SelectDirective } from '@app/directive/select/select.directive';
import { I18n, provideI18nScope } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { AnalysisPreferenceService } from '@app/service/analysis-preference.service';
import { BoardPreferenceService } from '@app/service/board-preference.service';
import { SoundService } from '@app/service/sound.service';
import { bindSetting } from '@app/util/setting-binding';

@Component({
	templateUrl: './setting-board.page.html',
	styleUrl: './setting-board.page.scss',
	imports: [
		ReactiveFormsModule,
		RadioCheckboxDirective,
		SelectDirective,
		BoardDemoComponent,
		I18nPipe,
	],
	providers: [provideI18nScope('setting')],
})
export class SettingBoardPage {
	protected readonly I18n = I18n;

	readonly moveSpeeds = MOVE_SPEEDS;
	readonly speedLabel = MOVE_SPEED_LABEL;
	readonly moveAnimations = MOVE_ANIMATIONS;
	readonly animationLabel = MOVE_ANIMATION_LABEL;
	readonly inputLabel = MOVE_INPUT_LABEL;
	readonly analysisDepths = ANALYSIS_DEPTHS;

	private readonly boardPreference = inject(BoardPreferenceService);
	private readonly analysisPreference = inject(AnalysisPreferenceService);
	private readonly sound = inject(SoundService);

	private readonly analysisDepth = computed(() => String(this.analysisPreference.depth()));

	readonly form = new FormGroup({
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
		analysisBar: new FormControl<boolean>(this.analysisPreference.isBarShown(), {
			nonNullable: true,
		}),
		analysisDepth: new FormControl<string>(this.analysisDepth(), { nonNullable: true }),
	});

	// Mirrors both the stored value and the correction made when a selection would
	// otherwise leave the board with no way to move a piece.
	private readonly moveInput = computed(() => ({
		click: this.isMethodEnabled('click'),
		drag: this.isMethodEnabled('drag'),
	}));

	constructor() {
		this.bindBoard();
		this.bindAnalysis();
	}

	private bindBoard(): void {
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

	private bindAnalysis(): void {
		bindSetting(this.form.controls.analysisBar, this.analysisPreference.isBarShown, (isShown) => {
			this.analysisPreference.updateBar(isShown);
		});

		bindSetting(this.form.controls.analysisDepth, this.analysisDepth, (depth) => {
			this.analysisPreference.updateDepth(normalizeAnalysisDepth(Number(depth)));
		});
	}

	private isMethodEnabled(method: 'click' | 'drag'): boolean {
		return this.boardPreference.moveInputMethods().includes(method);
	}
}
