import { TestBed } from '@angular/core/testing';
import type { AuthUser, LoginRequest } from '@chesspecker/api-definitions';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LocalOwner } from '@app/definition/model/setting/local-owner.type';
import { SessionStore } from '@app/store/session.store';
import { DiscardLocalDataUseCase } from '@app/use-case/discard-local-data.use-case';
import { LocalOwnerUseCase } from '@app/use-case/local-owner.use-case';
import { LogInUseCase } from '@app/use-case/log-in.use-case';

type BeforeAdopting = (user: AuthUser) => Promise<void>;

const ada: AuthUser = { uuid: 'uuid-ada', username: 'ada', role: 'registered' };

const adaAgain: AuthUser = { uuid: 'uuid-other', username: 'ada', role: 'registered' };

const bob: AuthUser = { uuid: 'uuid-bob', username: 'bob', role: 'registered' };

const adaStamp: LocalOwner = { uuid: 'uuid-ada', username: 'ada' };

function credentials(username: string): LoginRequest {
	return { username, password: 'secret42' };
}

interface Options {
	readonly owner?: LocalOwner;
	readonly confirmed?: boolean;
}

function configure(options: Options = {}) {
	const hooks: BeforeAdopting[] = [];
	const localOwner = {
		read: vi.fn(() => Promise.resolve(options.owner)),
		claim: vi.fn(() => Promise.resolve()),
	};
	const discard = {
		confirm: vi.fn(() => Promise.resolve(options.confirmed ?? true)),
		execute: vi.fn(() => Promise.resolve()),
	};
	const sessionStore = {
		logIn: vi.fn((_request: LoginRequest, beforeAdopting?: BeforeAdopting) => {
			if (undefined !== beforeAdopting) {
				hooks.push(beforeAdopting);
			}

			return Promise.resolve(true);
		}),
	};

	TestBed.configureTestingModule({
		providers: [
			{ provide: LocalOwnerUseCase, useValue: localOwner },
			{ provide: DiscardLocalDataUseCase, useValue: discard },
			{ provide: SessionStore, useValue: sessionStore },
		],
	});

	return { localOwner, discard, sessionStore, hooks, logIn: TestBed.inject(LogInUseCase) };
}

async function adopt(hooks: readonly BeforeAdopting[], user: AuthUser): Promise<void> {
	await hooks[0]?.(user);
}

describe('LogInUseCase', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('lets the device owner back in without touching what they trained offline', async () => {
		const { logIn, discard, localOwner, hooks } = configure({ owner: adaStamp });

		expect(await logIn.execute(credentials('ada'))).toBe(true);

		await adopt(hooks, ada);

		expect(discard.confirm).not.toHaveBeenCalled();
		expect(discard.execute).not.toHaveBeenCalled();
		expect(localOwner.claim).toHaveBeenCalledWith(ada);
	});

	it('asks before handing the device to a different account', async () => {
		const { logIn, discard, localOwner, hooks } = configure({ owner: adaStamp });

		expect(await logIn.execute(credentials('bob'))).toBe(true);
		expect(discard.confirm).toHaveBeenCalledTimes(1);

		await adopt(hooks, bob);

		expect(discard.execute).toHaveBeenCalledTimes(1);
		expect(localOwner.claim).toHaveBeenCalledWith(bob);
	});

	it('never asks the API for a session the answer said no to', async () => {
		const { logIn, sessionStore, discard } = configure({ owner: adaStamp, confirmed: false });

		expect(await logIn.execute(credentials('bob'))).toBe(false);
		expect(sessionStore.logIn).not.toHaveBeenCalled();
		expect(discard.execute).not.toHaveBeenCalled();
	});

	it('clears a device nobody had claimed before adopting it', async () => {
		const { logIn, discard, localOwner, hooks } = configure();

		expect(await logIn.execute(credentials('ada'))).toBe(true);

		await adopt(hooks, ada);

		expect(discard.execute).toHaveBeenCalledTimes(1);
		expect(localOwner.claim).toHaveBeenCalledWith(ada);
	});

	it('discards without asking when the same name turns out to be another account', async () => {
		const { logIn, discard, hooks } = configure({ owner: adaStamp });

		expect(await logIn.execute(credentials('ada'))).toBe(true);
		expect(discard.confirm).not.toHaveBeenCalled();

		await adopt(hooks, adaAgain);

		expect(discard.execute).toHaveBeenCalledTimes(1);
	});

	it('waits for the session to be adopted before it wipes anything', async () => {
		const { logIn, discard, hooks } = configure();

		await logIn.execute(credentials('ada'));

		expect(discard.execute).not.toHaveBeenCalled();

		await adopt(hooks, ada);

		expect(discard.execute).toHaveBeenCalledTimes(1);
	});
});
