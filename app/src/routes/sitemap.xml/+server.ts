import { ORIGIN, PHOENIX_API_ORIGIN } from '$app/env/private';
import { Data, Effect } from 'effect';
import { apiRequestEffect } from '#config/api/request.js';
import { parseDiscoveryPage } from '#lib/hooks/api/content/contract.js';
import {
	contentListSitemapItems,
	contentSitemapItem,
	sitemapXml,
	staticSitemapItems
} from '#lib/seo/sitemap.js';
import type { DiscoveryEntry } from '#lib/hooks/api/content/types.js';
import type { RequestHandler } from './$types';

const MAX_URLS = 50_000;
const MAX_PAGES = 500;
const MAX_BYTES = 50 * 1024 * 1024;

/** Discovery returned data that cannot produce a complete, valid sitemap. */
class DiscoveryFailed extends Data.TaggedError('DiscoveryFailed')<{ readonly reason: string }> {}

/** Pages through Phoenix's discovery endpoint and returns every published content URL. */
const discoverContent = Effect.fnUntraced(function* (
	origin: string,
	fetcher: typeof fetch,
	maxItems: number
) {
	const items: ReturnType<typeof staticSitemapItems> = [];
	const discovered: DiscoveryEntry[] = [];
	const seenCursors = new Set<string>();
	let cursor: string | null = null;
	let pages = 0;
	do {
		if (++pages > MAX_PAGES) {
			return yield* new DiscoveryFailed({ reason: 'Discovery exceeded 500 pages' });
		}
		const query = new URLSearchParams({ limit: '200' });
		if (cursor) query.set('cursor', cursor);
		const payload = yield* apiRequestEffect<unknown>(`/content/discovery?${query}`, { fetcher });
		const page = parseDiscoveryPage(payload);
		if (!page) return yield* new DiscoveryFailed({ reason: 'Invalid discovery page' });
		for (const entry of page.items) {
			const item = contentSitemapItem(origin, entry);
			if (!item) return yield* new DiscoveryFailed({ reason: 'Invalid discovery URL' });
			items.push(item);
			discovered.push(entry);
		}
		if (items.length > maxItems) {
			return yield* new DiscoveryFailed({ reason: 'Sitemap exceeds 50,000 URLs' });
		}
		cursor = page.nextCursor;
		if (cursor) {
			if (seenCursors.has(cursor)) {
				return yield* new DiscoveryFailed({ reason: 'Repeated discovery cursor' });
			}
			seenCursors.add(cursor);
		}
	} while (cursor);
	items.push(...contentListSitemapItems(origin, discovered));
	return items;
});

export const GET: RequestHandler = async ({ fetch }) => {
	if (!ORIGIN) return new Response('Public ORIGIN is not configured', { status: 503 });
	const items = staticSitemapItems(ORIGIN);
	if (PHOENIX_API_ORIGIN) {
		const content = await Effect.runPromise(
			discoverContent(ORIGIN, fetch, MAX_URLS - items.length).pipe(
				// Any discovery problem means the sitemap would be incomplete, so none is served
				Effect.catchCause(() => Effect.succeed(null))
			)
		);
		if (!content) return new Response('Sitemap discovery is unavailable', { status: 503 });
		items.push(...content);
	}
	if (items.length > MAX_URLS || new Set(items.map((item) => item.url)).size !== items.length) {
		return new Response('Sitemap limit or duplicate URL', { status: 503 });
	}
	const body = sitemapXml(items);
	if (new TextEncoder().encode(body).byteLength > MAX_BYTES) {
		return new Response('Sitemap exceeds 50 MB', { status: 503 });
	}
	return new Response(body, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': 'no-store'
		}
	});
};
