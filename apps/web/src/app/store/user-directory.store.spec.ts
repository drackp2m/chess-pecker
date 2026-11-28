import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { AuthUser, Avatar, UserAvatar } from '@chesspecker/api-definitions';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UserRepository } from '@app/repository/user.repository';
import { SessionStore } from '@app/store/session.store';
import { UserDirectoryStore } from '@app/store/user-directory.store';

const KNIGHT: Avatar = { piece: 'knight', color: 'ivory', background: 'ink' };
const QUEEN: Avatar = { piece: 'queen', color: 'red', background: 'sky' };

const me: AuthUser = { uuid: 'uuid-me', username: 'me', role: 'registered', avatar: QUEEN };

interface Options {
	readonly authenticated?: boolean;
	readonly answer?: (uuids: readonly string[]) => Promise<readonly UserAvatar[]>;
}

function configure(options: Options = {}) {
	const authenticated = signal(options.authenticated ?? true);
	const user = signal<AuthUser | null>(me);
	const session = {
		user,
		avatar: () => user()?.avatar ?? null,
		isAuthenticated: authenticated,
	};
	const avatars = vi.fn(
		options.answer ??
			((uuids: readonly string[]) =>
				Promise.resolve(uuids.map((uuid) => ({ uuid, avatar: KNIGHT })))),
	);

	TestBed.configureTestingModule({
		providers: [
			{ provide: SessionStore, useValue: session },
			{ provide: UserRepository, useValue: { avatars } },
		],
	});

	return { directory: TestBed.inject(UserDirectoryStore), avatars, authenticated, user };
}

async function settle(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('UserDirectoryStore', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('asks for every unknown account of one render in a single call', async () => {
		const { directory, avatars } = configure();

		directory.request('uuid-a');
		directory.request('uuid-b');
		directory.request('uuid-a');
		await settle();

		expect(avatars).toHaveBeenCalledTimes(1);
		expect(avatars).toHaveBeenCalledWith(['uuid-a', 'uuid-b']);
		expect(directory.avatarOf('uuid-a')).toStrictEqual(KNIGHT);
	});

	it('does not ask again for an account it already asked about', async () => {
		const { directory, avatars } = configure();

		directory.request('uuid-a');
		await settle();
		directory.request('uuid-a');
		await settle();

		expect(avatars).toHaveBeenCalledTimes(1);
	});

	it('does not ask for an account that a list already brought', async () => {
		const { directory, avatars } = configure();

		directory.remember([{ uuid: 'uuid-a', avatar: null }]);
		directory.request('uuid-a');
		await settle();

		expect(avatars).not.toHaveBeenCalled();
		expect(directory.avatarOf('uuid-a')).toBeNull();
	});

	it('takes a newer avatar from a list over the one it had', () => {
		const { directory } = configure();

		directory.remember([{ uuid: 'uuid-a', avatar: KNIGHT }]);
		directory.remember([{ uuid: 'uuid-a', avatar: QUEEN }]);

		expect(directory.avatarOf('uuid-a')).toStrictEqual(QUEEN);
	});

	it('answers for the account in session from the session, never from a call', async () => {
		const { directory, avatars, user } = configure();

		directory.request(me.uuid);
		await settle();

		expect(avatars).not.toHaveBeenCalled();
		expect(directory.avatarOf(me.uuid)).toStrictEqual(QUEEN);

		user.set({ ...me, avatar: KNIGHT });

		expect(directory.avatarOf(me.uuid)).toStrictEqual(KNIGHT);
	});

	it('does not ask without a session, and asks once there is one', async () => {
		const { directory, avatars, authenticated } = configure({ authenticated: false });

		directory.request('uuid-a');
		await settle();

		expect(avatars).not.toHaveBeenCalled();

		authenticated.set(true);
		directory.request('uuid-a');
		await settle();

		expect(avatars).toHaveBeenCalledTimes(1);
	});

	it('asks again after a failed call', async () => {
		const answer = vi
			.fn<(uuids: readonly string[]) => Promise<readonly UserAvatar[]>>()
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValue([{ uuid: 'uuid-a', avatar: KNIGHT }]);
		const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const { directory, avatars } = configure({ answer });

		directory.request('uuid-a');
		await settle();
		directory.request('uuid-a');
		await settle();

		expect(avatars).toHaveBeenCalledTimes(2);
		expect(directory.avatarOf('uuid-a')).toStrictEqual(KNIGHT);

		errors.mockRestore();
	});

	it('forgets everything on reset, so the next account starts from nothing', async () => {
		const { directory, avatars } = configure();

		directory.request('uuid-a');
		await settle();
		directory.reset();

		expect(directory.avatarOf('uuid-a')).toBeUndefined();

		directory.request('uuid-a');
		await settle();

		expect(avatars).toHaveBeenCalledTimes(2);
	});
});
