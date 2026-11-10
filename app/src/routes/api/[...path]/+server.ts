import { PHOENIX_API_ORIGIN } from '$app/env/private';
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
	'content-type',
	'etag',
	'last-modified',
	'retry-after',
	'vary'
];

const proxy: RequestHandler = async ({ request, url, fetch }) => {
	if (!PHOENIX_API_ORIGIN) {
		return Response.json({ message: 'Phoenix API origin is not configured' }, { status: 503 });
	}

	const target = new URL(url.pathname + url.search, PHOENIX_API_ORIGIN);
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
		const bytes = await request.arrayBuffer();
		if (bytes.byteLength > 0) body = bytes;
	}

	try {
		const upstream = await fetch(target, {
			method: request.method,
			headers,
			body,
			redirect: 'manual',
			signal: request.signal
		});
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
				const redirect = new URL(location, PHOENIX_API_ORIGIN);
				resultHeaders.set(
					'location',
					redirect.origin === PHOENIX_API_ORIGIN
						? redirect.pathname + redirect.search + redirect.hash
						: location
				);
			} catch {
				resultHeaders.set('location', location);
			}
		}

		return new Response(upstream.body, { status: upstream.status, headers: resultHeaders });
	} catch {
		return Response.json({ message: 'Phoenix API is unavailable' }, { status: 502 });
	}
};

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
