import type { ApiEndpoint, ApiEndpointMap } from '@chesspecker/api-definitions';

type Empty = Record<never, never>;

type Hole<K extends string, T> = Empty extends T
	? Readonly<Partial<Record<K, T>>>
	: Readonly<Record<K, T>>;

type PathHole<E extends ApiEndpoint> = E extends { path: infer P } ? Hole<'path', P> : Empty;

type ParamsHole<E extends ApiEndpoint> = E extends { params: infer P } ? Hole<'params', P> : Empty;

type QueryHole<E extends ApiEndpoint> = E extends { query: infer Q } ? Hole<'query', Q> : Empty;

export interface ApiCancellation {
	readonly cancellable?: boolean;
}

export type ApiRequestOptions<E extends ApiEndpoint> = PathHole<E> &
	ParamsHole<E> &
	QueryHole<E> &
	ApiCancellation;

export type ApiCaller<M extends ApiEndpointMap<M>> = <R extends keyof M & string>(
	route: R,
	...options: Empty extends ApiRequestOptions<M[R]>
		? [options?: ApiRequestOptions<M[R]>]
		: [options: ApiRequestOptions<M[R]>]
) => Promise<M[R]['response']>;

export interface ApiCallOptions {
	readonly path?: Readonly<Record<string, string>>;
	readonly params?: Readonly<Record<string, unknown>>;
	readonly query?: Readonly<Record<string, unknown>>;
	readonly cancellable?: boolean;
}
