import { TestBed } from '@angular/core/testing';
import type { AuthUser, RegisterRequest } from '@chesspecker/api-definitions';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LocalOwner } from '@app/definition/model/setting/local-owner.type';
import { SessionStore } from '@app/store/session.store';
import { DiscardLocalDataUseCase } from '@app/use-case/discard-local-data.use-case';
import { LocalOwnerUseCase } from '@app/use-case/local-owner.use-case';
import { RegisterUseCase } from '@app/use-case/register.use-case';

type BeforeAdopting = (user: AuthUser) => Promise<void>;

const request: RegisterRequest = { username: 'ada', password: 'secret42' };

const adaStamp: LocalOwner = { uuid: 'uuid-ada', username: 'ada' };

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
		register: vi.fn((_request: RegisterRequest, beforeAdopting?: BeforeAdopting) => {
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

	return { localOwner, discard, sessionStore, hooks, register: TestBed.inject(RegisterUseCase) };
}

describe('RegisterUseCase', () => {
	afterEach(() => {
		TestBed.resetTestingModule();
	});

	it('carries an anonymous training into the account it opens', async () => {
		const { register, discard, sessionStore, hooks } = configure();

		expect(await register.execute(request)).toBe(true);
		expect(sessionStore.register).toHaveBeenCalledWith(request);
		expect(discard.confirm).not.toHaveBeenCalled();
		expect(discard.execute).not.toHaveBeenCalled();
		expect(hooks).toHaveLength(0);
	});

	it('asks before opening an account on a device that belongs to somebody else', async () => {
		const { register, discard, hooks } = configure({ owner: adaStamp });

		expect(await register.execute(request)).toBe(true);
		expect(discard.confirm).toHaveBeenCalledTimes(1);
		expect(discard.execute).not.toHaveBeenCalled();

		await hooks[0]?.({ uuid: 'uuid-new', username: 'ada', role: 'registered' });

		expect(discard.execute).toHaveBeenCalledTimes(1);
	});

	it('opens no account when the answer is no', async () => {
		const { register, sessionStore, discard } = configure({ owner: adaStamp, confirmed: false });

		expect(await register.execute(request)).toBe(false);
		expect(sessionStore.register).not.toHaveBeenCalled();
		expect(discard.execute).not.toHaveBeenCalled();
	});
});
