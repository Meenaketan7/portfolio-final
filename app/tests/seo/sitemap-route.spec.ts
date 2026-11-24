import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

type Route = typeof import('../../src/routes/sitemap.xml/+server.js');
type SitemapEvent = Parameters<Route['GET']>[0];

const HOUR = 60 * 60 * 1000;

// The route keeps its last sitemap in memory, so every test loads a fresh copy of it
const loadRoute = async () => (await import('../../src/routes/sitemap.xml/+server.js')).GET;

const entry = (slug: string, updatedAt = '2026-11-10T00:00:00Z') => ({
	kind: 'post',
	locale: 'en',
	slug,
	updatedAt,
	translations: { en: { slug, indexable: true } }
});

/** Answers each discovery request with the next page (then 500s), and records the requested paths */
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

const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

beforeEach(() => {
	vi.resetModules();
});

afterEach(() => {
	env.ORIGIN = undefined;
	env.PHOENIX_API_ORIGIN = undefined;
	vi.restoreAllMocks();
});

describe('sitemap.xml route', () => {
	it('is unavailable without a public origin', async () => {
		const GET = await loadRoute();
		const response = await GET(discovery().event);

		expect(response.status).toBe(503);
		expect(await response.text()).toBe('Public ORIGIN is not configured');
	});

	it('serves only static pages when Phoenix is not configured', async () => {
		env.ORIGIN = 'https://site.test';
		const GET = await loadRoute();
		const { paths, event } = discovery();
		const response = await GET(event);

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('application/xml; charset=utf-8');
		expect(response.headers.get('cache-control')).toBe('public, max-age=3600');
		expect(paths).toEqual([]);
	});

	it('follows discovery cursors and lists every post plus its list page', async () => {
		env.ORIGIN = 'https://site.test';
		env.PHOENIX_API_ORIGIN = 'http://phoenix.internal:4000';
		const GET = await loadRoute();
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
		expect(locs(xml)).toEqual([
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
	])('is unavailable when %s and no earlier sitemap exists', async (_case, pages) => {
		env.ORIGIN = 'https://site.test';
		env.PHOENIX_API_ORIGIN = 'http://phoenix.internal:4000';
		const GET = await loadRoute();

		const response = await GET(discovery(...pages).event);

		expect(response.status).toBe(503);
		expect(await response.text()).toBe('Sitemap discovery is unavailable');
	});

	it('refuses duplicate URLs', async () => {
		env.ORIGIN = 'https://site.test';
		env.PHOENIX_API_ORIGIN = 'http://phoenix.internal:4000';
		const GET = await loadRoute();
		const { event } = discovery({ items: [entry('same'), entry('same')], nextCursor: null });

		const response = await GET(event);

		expect(response.status).toBe(503);
		expect(await response.text()).toBe('Sitemap limit or duplicate URL');
	});

	it('reuses a sitemap for an hour before asking Phoenix again', async () => {
		env.ORIGIN = 'https://site.test';
		env.PHOENIX_API_ORIGIN = 'http://phoenix.internal:4000';
		const now = vi.spyOn(Date, 'now').mockReturnValue(0);
		const GET = await loadRoute();
		const { paths, event } = discovery(
			{ items: [entry('first')], nextCursor: null },
			{ items: [entry('second')], nextCursor: null }
		);

		const first = await (await GET(event)).text();
		now.mockReturnValue(HOUR - 1);
		const cached = await (await GET(event)).text();
		now.mockReturnValue(HOUR + 1);
		const refreshed = await (await GET(event)).text();

		expect(paths).toHaveLength(2);
		expect(cached).toBe(first);
		expect(locs(refreshed)).toContain('https://site.test/blog/second');
	});

	it('keeps serving the last complete sitemap while a rebuild fails', async () => {
		env.ORIGIN = 'https://site.test';
		env.PHOENIX_API_ORIGIN = 'http://phoenix.internal:4000';
		const now = vi.spyOn(Date, 'now').mockReturnValue(0);
		const GET = await loadRoute();
		// The second discovery request gets a 500
		const { paths, event } = discovery({ items: [entry('first')], nextCursor: null });

		const first = await GET(event);
		const firstXml = await first.text();
		now.mockReturnValue(HOUR + 1);
		const stale = await GET(event);

		expect(paths).toHaveLength(2);
		expect(stale.status).toBe(200);
		expect(await stale.text()).toBe(firstXml);
	});

	it('walks discovery once for concurrent requests', async () => {
		env.ORIGIN = 'https://site.test';
		env.PHOENIX_API_ORIGIN = 'http://phoenix.internal:4000';
		const GET = await loadRoute();
		const { paths, event } = discovery({ items: [entry('first')], nextCursor: null });

		const responses = await Promise.all([GET(event), GET(event), GET(event)]);

		expect(paths).toHaveLength(1);
		expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
	});
});
