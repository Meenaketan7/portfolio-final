import { Data, Effect, Predicate } from 'effect';
import { apiConfig } from '#config/api/api-config.js';
import type { Locale } from '#lib/paraglide/runtime.js';

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiRequestOptions = {
	method?: ApiMethod;
	data?: unknown;
	fetcher?: typeof fetch;
	signal?: AbortSignal;
	headers?: HeadersInit;
	/** Explicit page locale for a language-dependent API response. */
	locale?: Locale;
};

// This module reaches the browser through the #lib barrel. `@__PURE__` marks the top-level Effect
// calls as side-effect free, so pages that never call the API do not ship Effect at all.

/** Phoenix answered with an error status; `details` keeps the parsed response body. */
export class ApiError
	extends /* @__PURE__ */ Data.TaggedError('ApiError')<{
		readonly status: number;
		readonly message: string;
		readonly details: unknown;
	}> {}

/** The request never reached Phoenix: offline, DNS failure, or connection refused. */
export class ApiNetworkError
	extends /* @__PURE__ */ Data.TaggedError('ApiNetworkError')<{
		readonly cause: TypeError;
	}>
{
	override readonly message = 'Unable to reach the server. Check your connection and try again.';
}

/**
 * Calls Phoenix through the same-origin `/api` proxy. Fails with `ApiError` or `ApiNetworkError`;
 * an invalid path or a cancelled request (AbortError) is a defect and is rethrown unchanged.
 */
export const apiRequestEffect = /* @__PURE__ */ Effect.fnUntraced(function* <T>(
	path: string,
	options: ApiRequestOptions = {}
) {
	if (!path.startsWith('/') || path.startsWith('//')) {
		return yield* Effect.die(new TypeError('API paths must start with one slash'));
	}

	const { method = 'GET', data, fetcher = fetch, signal, headers: customHeaders, locale } = options;
	const headers = new Headers(customHeaders);
	headers.set('accept', 'application/json');
	if (locale) headers.set('accept-language', new Intl.Locale(locale).toString());
	if (data !== undefined) headers.set('content-type', 'application/json');

	const response = yield* Effect.tryPromise({
		try: () =>
			fetcher(`${apiConfig.basePath}${path}`, {
				method,
				credentials: 'same-origin',
				headers,
				body: data === undefined ? undefined : JSON.stringify(data),
				signal
			}),
		// fetch rejects with a TypeError when the network fails. Anything else, such as the
		// AbortError of a cancelled query, is not an API failure: rethrowing makes it a defect.
		catch: (cause) => {
			if (cause instanceof TypeError) return new ApiNetworkError({ cause });
			throw cause;
		}
	});

	// The caller declares the response type; it is not validated at runtime.
	if (response.status === 204) return undefined as T;

	const contentType = response.headers.get('content-type') ?? '';
	const payload: unknown = yield* Effect.promise(() =>
		contentType.includes('json')
			? response.json().catch(() => null)
			: response.text().catch(() => null)
	);

	if (!response.ok) {
		return yield* new ApiError({
			status: response.status,
			message:
				Predicate.isObject(payload) && Predicate.isString(payload.message)
					? payload.message
					: response.statusText || `HTTP ${response.status}`,
			details: payload
		});
	}

	return payload as T;
});

/**
 * Promise version of `apiRequestEffect` for TanStack Query and SvelteKit `load` functions.
 * It rejects with the same `ApiError` / `ApiNetworkError` instances (or the original defect).
 */
export const apiRequest = <T>(path: string, options?: ApiRequestOptions): Promise<T> =>
	Effect.runPromise(apiRequestEffect<T>(path, options));
