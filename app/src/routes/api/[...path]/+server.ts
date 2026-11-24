import { PHOENIX_API_ORIGIN } from '$app/env/private';
import { Data, Effect } from 'effect';
import type { RequestHandler } from './$types';

const requestHeaders = [
	'accept',
	'accept-language',
	'authorization',
	'content-type',
	'cookie',
	'if-match',
	'if-none-match',
	'if-modified-since',
	'x-csrf-token'
];

const responseHeaders = [
	'cache-control',
	'content-language',
	'content-type',
	'etag',
	'last-modified',
	'retry-after',
	'vary'
];

/** Phoenix could not be reached, or its response could not be passed through. */
class PhoenixUnavailable extends Data.TaggedError('PhoenixUnavailable')<{
	readonly cause: unknown;
}> {}

const proxy: RequestHandler = ({ request, url, fetch }) =>
	Effect.gen(function* () {
		const origin = PHOENIX_API_ORIGIN;
		if (!origin) {
			return Response.json({ message: 'Phoenix API origin is not configured' }, { status: 503 });
		}

		const target = new URL(url.pathname + url.search, origin);
		if (!target.pathname.startsWith('/api/')) {
			return Response.json({ message: 'Invalid API path' }, { status: 400 });
		}

		const headers = new Headers();
		for (const name of requestHeaders) {
			const value = request.headers.get(name);
			if (value !== null) headers.set(name, value);
		}

		let body: ArrayBuffer | undefined;
		if (request.method !== 'GET' && request.method !== 'HEAD') {
			const bytes = yield* Effect.promise(() => request.arrayBuffer());
			if (bytes.byteLength > 0) body = bytes;
		}

		return yield* Effect.tryPromise({
			try: () =>
				fetch(target, {
					method: request.method,
					headers,
					body,
					redirect: 'manual',
					signal: request.signal
				}).then((upstream) => proxyResponse(upstream, origin)),
			catch: (cause) => new PhoenixUnavailable({ cause })
		});
	}).pipe(
		Effect.catchTag('PhoenixUnavailable', () =>
			Effect.succeed(Response.json({ message: 'Phoenix API is unavailable' }, { status: 502 }))
		),
		Effect.runPromise
	);

/** Passes Phoenix's answer through with only the allowlisted headers. */
function proxyResponse(upstream: Response, origin: string): Response {
	const resultHeaders = new Headers();
	for (const name of responseHeaders) {
		const value = upstream.headers.get(name);
		if (value !== null) resultHeaders.set(name, value);
	}
	for (const cookie of upstream.headers.getSetCookie()) {
		resultHeaders.append('set-cookie', cookie);
	}
	const location = upstream.headers.get('location');
	if (location) {
		try {
			const redirect = new URL(location, origin);
			resultHeaders.set(
				'location',
				redirect.origin === origin ? redirect.pathname + redirect.search + redirect.hash : location
			);
		} catch {
			resultHeaders.set('location', location);
		}
	}

	return new Response(upstream.body, { status: upstream.status, headers: resultHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
