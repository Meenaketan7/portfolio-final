import { describe, expect, it, vi } from 'vitest';

vi.mock('$app/env/private', () => ({ PHOENIX_API_ORIGIN: undefined }));

import { GET } from '../../src/routes/api/[...path]/+server.js';

type ProxyEvent = Parameters<typeof GET>[0];

function event(request: Request, fetcher: typeof fetch): ProxyEvent {
	return { request, url: new URL(request.url), fetch: fetcher } as ProxyEvent;
}

describe('Phoenix API proxy without an origin', () => {
	it('returns 503 without calling the backend', async () => {
		const request = new Request('http://app.local/api/v1/user');
		const fetcher = vi.fn(async (_input: RequestInfo | URL) => Response.json({ ok: true }));
		const response = await GET(event(request, fetcher));

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ message: 'Phoenix API origin is not configured' });
		expect(fetcher).not.toHaveBeenCalled();
	});
});
