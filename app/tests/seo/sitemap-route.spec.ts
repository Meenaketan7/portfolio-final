import { afterEach, describe, expect, it, vi } from 'vitest';

// The route reads both origins on every request; getters let each test switch them
const env = vi.hoisted(() => ({
	ORIGIN: undefined as string | undefined,
	PHOENIX_API_ORIGIN: undefined as string | undefined
}));
vi.mock('$app/env/private', () => ({
	get ORIGIN() {
		return env.ORIGIN;
	},
	get PHOENIX_API_ORIGIN() {
		return env.PHOENIX_API_ORIGIN;
	}
}));

import { GET } from '../../src/routes/sitemap.xml/+server.js';

type SitemapEvent = Parameters<typeof GET>[0];

const entry = (slug: string, updatedAt = '2026-11-10T00:00:00Z') => ({
	kind: 'post',
	locale: 'en',
	slug,
	updatedAt,
	translations: { en: { slug, indexable: true } }
});

/** Answers each discovery request with the next page, and records the requested paths */
function discovery(...pages: unknown[]) {
	const paths: string[] = [];
	const fetcher = vi.fn(async (input: RequestInfo | URL) => {
		paths.push(String(input));
		const page = pages[paths.length - 1];
		return page === undefined
			? Response.json({ message: 'Server Error' }, { status: 500 })
			: Response.json(page);
	});
	return { paths, event: { fetch: fetcher } as unknown as SitemapEvent };
}

afterEach(() => {
	env.ORIGIN = undefined;
	env.PHOENIX_API_ORIGIN = undefined;
});

describe('sitemap.xml route', () => {
	it('is unavailable without a public origin', async () => {
		const response = await GET(discovery().event);

		expect(response.status).toBe(503);
		expect(await response.text()).toBe('Public ORIGIN is not configured');
	});

	it('serves only static pages when Phoenix is not configured', async () => {
		env.ORIGIN = 'https://site.test';
		const { paths, event } = discovery();
		const response = await GET(event);

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('application/xml; charset=utf-8');
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(paths).toEqual([]);
	});

	it('follows discovery cursors and lists every post plus its list page', async () => {
		env.ORIGIN = 'https://site.test';
		env.PHOENIX_API_ORIGIN = 'http://phoenix.internal:4000';
		const { paths, event } = discovery(
			{ items: [entry('first', '2026-11-01T00:00:00Z')], nextCursor: 'page-2' },
			{ items: [entry('second', '2026-11-12T00:00:00Z')], nextCursor: null }
		);

		const response = await GET(event);
		const xml = await response.text();

		expect(response.status).toBe(200);
		expect(paths).toEqual([
			'/api/v1/content/discovery?limit=200',
			'/api/v1/content/discovery?limit=200&cursor=page-2'
		]);
		expect([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])).toEqual([
			'https://site.test/blog/first',
			'https://site.test/blog/second',
			'https://site.test/blog'
		]);
		expect(xml).toContain(
			'<loc>https://site.test/blog</loc><lastmod>2026-11-12T00:00:00Z</lastmod>'
		);
	});

	it.each([
		['the API fails', []],
		['a page is invalid', [{ items: 'not-a-list', nextCursor: null }]],
		[
			'a cursor repeats',
			[
				{ items: [entry('first')], nextCursor: 'again' },
				{ items: [entry('second')], nextCursor: 'again' }
			]
		]
	])('is unavailable when %s', async (_case, pages) => {
		env.ORIGIN = 'https://site.test';
		env.PHOENIX_API_ORIGIN = 'http://phoenix.internal:4000';

		const response = await GET(discovery(...pages).event);

		expect(response.status).toBe(503);
		expect(await response.text()).toBe('Sitemap discovery is unavailable');
	});

	it('refuses duplicate URLs', async () => {
		env.ORIGIN = 'https://site.test';
		env.PHOENIX_API_ORIGIN = 'http://phoenix.internal:4000';
		const { event } = discovery({ items: [entry('same'), entry('same')], nextCursor: null });

		const response = await GET(event);

		expect(response.status).toBe(503);
		expect(await response.text()).toBe('Sitemap limit or duplicate URL');
	});
});
