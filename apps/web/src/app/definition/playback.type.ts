import { MoveSpeed } from '@app/definition/move-speed.type';

export type PlaybackTag = 'reveal' | 'restart' | 'resume' | 'reply';

export type PlaybackLead = 'replay' | 'resume';

export type PlaybackStep =
	| { readonly kind: 'seek'; readonly to: number; readonly animate: boolean }
	| { readonly kind: 'play'; readonly through: number; readonly lead: PlaybackLead };

export type PlaybackSeek = Extract<PlaybackStep, { kind: 'seek' }>;

export interface PlaybackProgram {
	readonly tag: PlaybackTag;
	readonly steps: readonly PlaybackStep[];
	readonly speed?: MoveSpeed;
}
