import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/env/private', () => ({ PHOENIX_API_ORIGIN: 'http://phoenix.internal:4000' }));

import { GET, POST } from '../../src/routes/api/[...path]/+server.js';

type ProxyEvent = Parameters<typeof GET>[0];

function event(request: Request, fetcher: typeof fetch): ProxyEvent {
	return { request, url: new URL(request.url), fetch: fetcher } as ProxyEvent;
}

describe('Phoenix API proxy', () => {
	it('forwards the path, query, body, and only intended request headers', async () => {
		const request = new Request('http://app.local/api/v1/user?active=1', {
			method: 'POST',
			headers: {
				accept: 'application/json',
				authorization: 'Bearer token',
				'content-type': 'application/json',
				cookie: 'session=abc',
				'x-csrf-token': 'csrf',
				'x-internal-secret': 'do-not-forward'
			},
			body: JSON.stringify({ name: 'Ada' })
		});
		const upstreamHeaders = new Headers({
			'content-type': 'application/json',
			'cache-control': 'private, no-store',
			'x-powered-by': 'Phoenix'
		});
		upstreamHeaders.append('set-cookie', 'session=next; HttpOnly; Path=/');
		upstreamHeaders.append('set-cookie', 'theme=dark; Path=/');
		const fetcher = vi.fn(
			async (_input: RequestInfo | URL, _init?: RequestInit) =>
				new Response(JSON.stringify({ id: '42' }), { status: 201, headers: upstreamHeaders })
		);

		const response = await POST(event(request, fetcher));
		const [target, options] = fetcher.mock.calls[0];
		const headers = new Headers(options?.headers);

		expect(String(target)).toBe('http://phoenix.internal:4000/api/v1/user?active=1');
		expect(options?.method).toBe('POST');
		expect(options?.redirect).toBe('manual');
		expect(options?.signal).toBe(request.signal);
		expect(headers.get('authorization')).toBe('Bearer token');
		expect(headers.get('cookie')).toBe('session=abc');
		expect(headers.get('x-csrf-token')).toBe('csrf');
		expect(headers.has('x-internal-secret')).toBe(false);
		expect(new TextDecoder().decode(options?.body as ArrayBuffer)).toBe('{"name":"Ada"}');
		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({ id: '42' });
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(response.headers.has('x-powered-by')).toBe(false);
		expect(response.headers.getSetCookie()).toEqual([
			'session=next; HttpOnly; Path=/',
			'theme=dark; Path=/'
		]);
	});

	it('rewrites Phoenix redirects to the public origin but keeps external redirects', async () => {
		const request = new Request('http://app.local/api/v1/user');
		const fetcher = vi
			.fn(async (_input: RequestInfo | URL) => new Response(null, { status: 302 }))
			.mockResolvedValueOnce(
				new Response(null, {
					status: 302,
					headers: { location: 'http://phoenix.internal:4000/api/v1/login?next=1#form' }
				})
			)
			.mockResolvedValueOnce(
				new Response(null, {
					status: 302,
					headers: { location: 'https://example.org/help' }
				})
			);

		const internal = await GET(event(request, fetcher));
		const external = await GET(event(request, fetcher));

		expect(internal.status).toBe(302);
		expect(internal.headers.get('location')).toBe('/api/v1/login?next=1#form');
		expect(external.headers.get('location')).toBe('https://example.org/help');
	});

	it('returns 502 when Phoenix is unreachable', async () => {
		const request = new Request('http://app.local/api/v1/user');
		const fetcher = vi.fn(async (_input: RequestInfo | URL): Promise<Response> => {
			throw new Error('connection refused');
		});

		const response = await GET(event(request, fetcher));

		expect(response.status).toBe(502);
		expect(await response.json()).toEqual({ message: 'Phoenix API is unavailable' });
	});

	it('rejects paths outside the API prefix before fetching', async () => {
		const request = new Request('http://app.local/other');
		const fetcher = vi.fn(async (_input: RequestInfo | URL) => Response.json({ ok: true }));

		const response = await GET(event(request, fetcher));

		expect(response.status).toBe(400);
		expect(fetcher).not.toHaveBeenCalled();
	});
});
