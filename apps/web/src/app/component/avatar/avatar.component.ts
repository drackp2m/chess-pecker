import { Component, computed, effect, inject, input } from '@angular/core';
import type { Avatar } from '@chesspecker/api-definitions';

import { ChessPieceComponent } from '@app/component/chess-piece/chess-piece.component';
import { UserDirectoryStore } from '@app/store/user-directory.store';
import { resolveAvatar } from '@app/util/avatar';

@Component({
	selector: 'app-avatar',
	templateUrl: './avatar.component.html',
	styleUrl: './avatar.component.scss',
	imports: [ChessPieceComponent],
	host: {
		'aria-hidden': 'true',
		'[style.--avatar-fill]': 'fill()',
		'[style.--avatar-outline]': 'outline()',
		'[style.--avatar-background]': 'background()',
	},
})
export class AvatarComponent {
	readonly uuid = input.required<string>();
	readonly preview = input<Avatar>();

	private readonly directory = inject(UserDirectoryStore);

	readonly resolved = computed(() =>
		resolveAvatar(this.uuid(), this.preview() ?? this.directory.avatarOf(this.uuid())),
	);

	readonly fill = computed(() => `var(--avatar-${this.resolved().color})`);
	readonly outline = computed(() => `var(--avatar-${this.resolved().color}-outline)`);
	readonly background = computed(() => `var(--avatar-${this.resolved().background})`);

	constructor() {
		effect(() => {
			if (undefined === this.preview()) {
				this.directory.request(this.uuid());
			}
		});
	}
}
