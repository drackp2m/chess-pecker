import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import type {
	ApiEndpointMap,
	ApiModule,
	ApiVerb,
	AuthGetRoutes,
	AuthPostRoutes,
	FriendshipDeleteRoutes,
	FriendshipGetRoutes,
	FriendshipPatchRoutes,
	FriendshipPostRoutes,
	PuzzleGetRoutes,
	PuzzlePostRoutes,
	SyncGetRoutes,
	SyncPostRoutes,
	TrainingDeleteRoutes,
	TrainingGetRoutes,
	TrainingPostRoutes,
	UserBlockDeleteRoutes,
	UserBlockGetRoutes,
	UserBlockPostRoutes,
	UserGetRoutes,
	UserSettingDeleteRoutes,
	UserSettingGetRoutes,
	UserSettingPutRoutes,
} from '@chesspecker/api-definitions';
import { EmptyError, Observable, filter, firstValueFrom, takeUntil } from 'rxjs';

import { ApiCallOptions, ApiCaller } from '@app/definition/api-sdk.type';
import { API_BASE_URL } from '@app/definition/api.constant';
import { ConnectionStore } from '@app/store/connection.store';
import { ApiCancelledError } from '@app/util/api-cancelled-error';

const MODULE_SEGMENT: Record<ApiModule, string> = {
	auth: 'auth',
	friendship: 'friendship',
	puzzle: 'puzzle',
	sync: 'sync',
	training: 'training',
	user: 'user',
	userBlock: 'user-block',
	userSetting: 'user-setting',
};

const IS_WRITE: Record<ApiVerb, boolean> = {
	GET: false,
	POST: true,
	PUT: true,
	PATCH: true,
	DELETE: true,
};

@Injectable({
	providedIn: 'root',
})
export class ApiSdkService {
	private readonly httpClient = inject(HttpClient);
	private readonly router = inject(Router);
	private readonly connectionStore = inject(ConnectionStore);

	private readonly navigations = this.router.events.pipe(
		filter((event): event is NavigationStart => event instanceof NavigationStart),
	);

	private readonly writesInFlight = signal(0);
	private readonly readsInFlight = signal(0);

	readonly pendingWrites = this.writesInFlight.asReadonly();
	readonly isSaving = computed(() => 0 < this.writesInFlight());
	readonly isFetching = computed(() => 0 < this.readsInFlight());

	readonly GET = {
		auth: this.caller<AuthGetRoutes>('GET', 'auth'),
		friendship: this.caller<FriendshipGetRoutes>('GET', 'friendship'),
		puzzle: this.caller<PuzzleGetRoutes>('GET', 'puzzle'),
		sync: this.caller<SyncGetRoutes>('GET', 'sync'),
		training: this.caller<TrainingGetRoutes>('GET', 'training'),
		user: this.caller<UserGetRoutes>('GET', 'user'),
		userBlock: this.caller<UserBlockGetRoutes>('GET', 'userBlock'),
		userSetting: this.caller<UserSettingGetRoutes>('GET', 'userSetting'),
	};

	readonly POST = {
		auth: this.caller<AuthPostRoutes>('POST', 'auth'),
		friendship: this.caller<FriendshipPostRoutes>('POST', 'friendship'),
		puzzle: this.caller<PuzzlePostRoutes>('POST', 'puzzle'),
		sync: this.caller<SyncPostRoutes>('POST', 'sync'),
		training: this.caller<TrainingPostRoutes>('POST', 'training'),
		userBlock: this.caller<UserBlockPostRoutes>('POST', 'userBlock'),
	};

	readonly PUT = {
		userSetting: this.caller<UserSettingPutRoutes>('PUT', 'userSetting'),
	};

	readonly PATCH = {
		friendship: this.caller<FriendshipPatchRoutes>('PATCH', 'friendship'),
	};

	readonly DELETE = {
		friendship: this.caller<FriendshipDeleteRoutes>('DELETE', 'friendship'),
		training: this.caller<TrainingDeleteRoutes>('DELETE', 'training'),
		userBlock: this.caller<UserBlockDeleteRoutes>('DELETE', 'userBlock'),
		userSetting: this.caller<UserSettingDeleteRoutes>('DELETE', 'userSetting'),
	};

	private caller<M extends ApiEndpointMap<M>>(verb: ApiVerb, module: ApiModule): ApiCaller<M> {
		return (route: string, options: ApiCallOptions = {}) => this.send(verb, module, route, options);
	}

	private send(
		verb: ApiVerb,
		module: ApiModule,
		route: string,
		options: ApiCallOptions,
	): Promise<unknown> {
		const isWrite = IS_WRITE[verb];
		const url = buildUrl(MODULE_SEGMENT[module], route, options.path);
		const request = this.httpClient.request<unknown>(verb, url, toHttpOptions(isWrite, options));
		const answer = this.awaitAnswer(request, options.cancellable ?? !isWrite, `${verb} ${url}`);

		return this.connectionStore.check(
			this.count(isWrite ? this.writesInFlight : this.readsInFlight, answer),
		);
	}

	private async awaitAnswer(
		request: Observable<unknown>,
		cancellable: boolean,
		description: string,
	): Promise<unknown> {
		if (!cancellable) {
			return firstValueFrom(request);
		}

		try {
			return await firstValueFrom(request.pipe(takeUntil(this.navigations)));
		} catch (error) {
			if (error instanceof EmptyError) {
				throw new ApiCancelledError(description);
			}

			throw error;
		}
	}

	private async count(counter: WritableSignal<number>, answer: Promise<unknown>): Promise<unknown> {
		counter.update((pending) => pending + 1);

		try {
			return await answer;
		} finally {
			counter.update((pending) => pending - 1);
		}
	}
}

function buildUrl(
	segment: string,
	route: string,
	path: Readonly<Record<string, string>> | undefined,
): string {
	const resolved = Object.entries(path ?? {}).reduce(
		(url, [name, value]) => url.replace(`:${name}`, encodeURIComponent(value)),
		route,
	);

	return `${API_BASE_URL}/${segment}${resolved}`;
}

function toHttpOptions(
	isWrite: boolean,
	options: ApiCallOptions,
): { params: HttpParams; body?: unknown } {
	if (isWrite) {
		return { params: toHttpParams(options.query), body: options.params ?? {} };
	}

	return { params: toHttpParams({ ...options.query, ...options.params }) };
}

function toHttpParams(source: Readonly<Record<string, unknown>> | undefined): HttpParams {
	return Object.entries(source ?? {}).reduce(
		(params, [key, value]) => appendParam(params, key, value),
		new HttpParams(),
	);
}

function appendParam(params: HttpParams, key: string, value: unknown): HttpParams {
	if ('string' === typeof value) {
		return params.append(key, value);
	}

	if ('number' === typeof value || 'boolean' === typeof value) {
		return params.append(key, value.toString());
	}

	if (isList(value)) {
		return value.reduce<HttpParams>((next, entry) => appendParam(next, key, entry), params);
	}

	return params;
}

const isList = (value: unknown): value is readonly unknown[] => Array.isArray(value);
