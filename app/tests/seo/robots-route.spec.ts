import { afterEach, describe, expect, it, vi } from 'vitest';

// The route reads ORIGIN on every request; a getter lets each test switch it
const env = vi.hoisted(() => ({ ORIGIN: undefined as string | undefined }));
vi.mock('$app/env/private', () => ({
	get ORIGIN() {
		return env.ORIGIN;
	}
}));

import { GET } from '../../src/routes/robots.txt/+server.js';

// The handler does not read the request event
const event = {} as Parameters<typeof GET>[0];

afterEach(() => {
	env.ORIGIN = undefined;
});

describe('robots.txt route', () => {
	it('blocks all crawling without a public origin', async () => {
		const response = await GET(event);

		expect(await response.text()).toBe('User-agent: *\nDisallow: /\n');
	});

	it('allows crawling and points at the sitemap when the public origin is known', async () => {
		env.ORIGIN = 'https://example.com';
		const response = await GET(event);

		expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
		expect(response.headers.get('cache-control')).toBe('public, max-age=3600');
		expect(await response.text()).toBe(
			'User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n'
		);
	});
});
