import { ORIGIN, PHOENIX_API_ORIGIN } from '$app/env/private';
import { Data, Effect, Result } from 'effect';
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
const CACHE_TTL_MS = 60 * 60 * 1000;

/** Discovery returned data that cannot produce a complete, valid sitemap. */
class DiscoveryFailed extends Data.TaggedError('DiscoveryFailed')<{ readonly reason: string }> {}

/** No complete sitemap can be built right now; `reason` is the 503 response body. */
class SitemapUnavailable extends Data.TaggedError('SitemapUnavailable')<{
	readonly reason: string;
}> {}

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

/** Builds the complete sitemap XML from the static registry and Phoenix's discovery feed. */
const buildSitemap = Effect.fnUntraced(function* (origin: string, fetcher: typeof fetch) {
	const items = staticSitemapItems(origin);
	if (PHOENIX_API_ORIGIN) {
		const content = yield* discoverContent(origin, fetcher, MAX_URLS - items.length).pipe(
			// Any discovery problem means the sitemap would be incomplete, so none is built
			Effect.catchCause(() =>
				Effect.fail(new SitemapUnavailable({ reason: 'Sitemap discovery is unavailable' }))
			)
		);
		items.push(...content);
	}
	if (items.length > MAX_URLS || new Set(items.map((item) => item.url)).size !== items.length) {
		return yield* new SitemapUnavailable({ reason: 'Sitemap limit or duplicate URL' });
	}
	const body = sitemapXml(items);
	if (new TextEncoder().encode(body).byteLength > MAX_BYTES) {
		return yield* new SitemapUnavailable({ reason: 'Sitemap exceeds 50 MB' });
	}
	return body;
});

/** The last complete sitemap: served for an hour, and afterwards while a rebuild fails. */
let lastBuilt: { origin: string; body: string; expires: number } | undefined;

/** The rebuild in progress, shared by concurrent requests so Phoenix is walked once. */
let rebuilding: Promise<Result.Result<string, SitemapUnavailable>> | undefined;

const rebuild = (origin: string, fetcher: typeof fetch) =>
	Effect.runPromise(
		buildSitemap(origin, fetcher).pipe(
			Effect.tap((body) =>
				Effect.sync(() => {
					lastBuilt = { origin, body, expires: Date.now() + CACHE_TTL_MS };
				})
			),
			Effect.result
		)
	);

const xmlResponse = (body: string) =>
	new Response(body, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': 'public, max-age=3600'
		}
	});

export const GET: RequestHandler = async ({ fetch }) => {
	if (!ORIGIN) return new Response('Public ORIGIN is not configured', { status: 503 });
	const origin = ORIGIN;
	if (lastBuilt?.origin === origin && lastBuilt.expires > Date.now()) {
		return xmlResponse(lastBuilt.body);
	}

	rebuilding ??= rebuild(origin, fetch).finally(() => {
		rebuilding = undefined;
	});
	const result = await rebuilding;
	if (Result.isSuccess(result)) return xmlResponse(result.success);
	// Keep serving the last complete sitemap rather than none; never a partial one
	if (lastBuilt?.origin === origin) return xmlResponse(lastBuilt.body);
	return new Response(result.failure.reason, { status: 503 });
};
