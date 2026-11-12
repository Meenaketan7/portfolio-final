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

export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly details: unknown
	) {
		super(message);
		this.name = 'ApiError';
	}
}

export class ApiNetworkError extends Error {
	constructor(cause: TypeError) {
		super('Unable to reach the server. Check your connection and try again.', { cause });
		this.name = 'ApiNetworkError';
	}
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
	if (!path.startsWith('/') || path.startsWith('//')) {
		throw new TypeError('API paths must start with one slash');
	}

	const { method = 'GET', data, fetcher = fetch, signal, headers: customHeaders, locale } = options;
	const headers = new Headers(customHeaders);
	headers.set('accept', 'application/json');
	if (locale) headers.set('accept-language', new Intl.Locale(locale).toString());
	if (data !== undefined) headers.set('content-type', 'application/json');

	let response: Response;
	try {
		response = await fetcher(`${apiConfig.basePath}${path}`, {
			method,
			credentials: 'same-origin',
			headers,
			body: data === undefined ? undefined : JSON.stringify(data),
			signal
		});
	} catch (error) {
		if (error instanceof TypeError) throw new ApiNetworkError(error);
		throw error;
	}

	if (response.status === 204) return undefined as T;

	const contentType = response.headers.get('content-type') ?? '';
	const payload: unknown = contentType.includes('json')
		? await response.json().catch(() => null)
		: await response.text().catch(() => null);

	if (!response.ok) {
		const message =
			payload &&
			typeof payload === 'object' &&
			'message' in payload &&
			typeof payload.message === 'string'
				? payload.message
				: response.statusText || `HTTP ${response.status}`;
		throw new ApiError(response.status, message, payload);
	}

	return payload as T;
}
