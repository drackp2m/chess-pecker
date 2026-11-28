import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AVATAR_COLORS, AVATAR_PIECES } from '@chesspecker/api-definitions';
import type { Avatar, AvatarColor, AvatarPiece } from '@chesspecker/api-definitions';

import { AvatarComponent } from '@app/component/avatar/avatar.component';
import { AVATAR_COLOR_LABEL, AVATAR_PIECE_LABEL } from '@app/definition/avatar.type';
import { ButtonDirective } from '@app/directive/button.directive';
import { I18n, provideI18nScope } from '@app/i18n';
import { I18nPipe } from '@app/pipe/i18n.pipe';
import { AvatarStore } from '@app/store/avatar.store';
import { SessionStore } from '@app/store/session.store';
import { resolveAvatar } from '@app/util/avatar';

@Component({
	templateUrl: './profile-avatar.page.html',
	styleUrl: './profile-avatar.page.scss',
	imports: [AvatarComponent, ButtonDirective, I18nPipe],
	providers: [provideI18nScope('profile')],
})
export class ProfileAvatarPage implements OnInit {
	protected readonly I18n = I18n;

	readonly pieces = AVATAR_PIECES;
	readonly colors = AVATAR_COLORS;
	readonly pieceLabel = AVATAR_PIECE_LABEL;
	readonly colorLabel = AVATAR_COLOR_LABEL;

	readonly store = inject(AvatarStore);
	readonly session = inject(SessionStore);

	readonly uuid = computed(() => this.session.user()?.uuid ?? '');

	private readonly initial = resolveAvatar(this.uuid(), this.session.avatar());

	readonly piece = signal<AvatarPiece>(this.initial.piece);
	readonly color = signal<AvatarColor>(this.initial.color);
	readonly background = signal<AvatarColor>(this.initial.background);

	readonly draft = computed<Avatar>(() => ({
		piece: this.piece(),
		color: this.color(),
		background: this.background(),
	}));

	readonly isDerived = computed(() => null === this.session.avatar());

	readonly isUnchanged = computed(() => {
		const saved = this.session.avatar();

		return (
			null !== saved &&
			saved.piece === this.piece() &&
			saved.color === this.color() &&
			saved.background === this.background()
		);
	});

	ngOnInit(): void {
		this.store.clearFeedback();
	}

	pickPiece(piece: AvatarPiece): void {
		this.piece.set(piece);
		this.store.clearFeedback();
	}

	pickColor(color: AvatarColor): void {
		this.color.set(color);
		this.store.clearFeedback();
	}

	pickBackground(background: AvatarColor): void {
		this.background.set(background);
		this.store.clearFeedback();
	}

	pieceOption(piece: AvatarPiece): Avatar {
		return { ...this.draft(), piece };
	}

	swatch(color: AvatarColor): string {
		return `var(--avatar-${color})`;
	}

	save(): void {
		void this.store.save(this.draft());
	}
}
