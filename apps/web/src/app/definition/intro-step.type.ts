import { I18n } from '@app/i18n';

export interface IntroStep {
	readonly title: string;
	readonly body: readonly string[];
}

export const INTRO_STEPS = [
	{
		title: I18n.intro.PURPOSE_TITLE,
		body: [I18n.intro.PURPOSE_BODY_1, I18n.intro.PURPOSE_BODY_2],
	},
	{
		title: I18n.intro.PATTERNS_TITLE,
		body: [I18n.intro.PATTERNS_BODY],
	},
	{
		title: I18n.intro.REPEAT_TITLE,
		body: [I18n.intro.REPEAT_BODY_1, I18n.intro.REPEAT_BODY_2],
	},
	{
		title: I18n.intro.RECOGNISE_TITLE,
		body: [I18n.intro.RECOGNISE_BODY_1, I18n.intro.RECOGNISE_BODY_2],
	},
	{
		title: I18n.intro.MISTAKES_TITLE,
		body: [I18n.intro.MISTAKES_BODY],
	},
	{
		title: I18n.intro.SPEED_TITLE,
		body: [I18n.intro.SPEED_BODY_1, I18n.intro.SPEED_BODY_2],
	},
	{
		title: I18n.intro.LEVEL_TITLE,
		body: [I18n.intro.LEVEL_BODY_1, I18n.intro.LEVEL_BODY_2],
	},
] as const satisfies readonly IntroStep[];
