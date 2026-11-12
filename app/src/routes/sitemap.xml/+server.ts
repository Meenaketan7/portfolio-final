import { ORIGIN, PHOENIX_API_ORIGIN } from '$app/env/private';
import { apiRequest } from '#config/api/request.js';
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

export const GET: RequestHandler = async ({ fetch }) => {
	if (!ORIGIN) return new Response('Public ORIGIN is not configured', { status: 503 });
	const items = staticSitemapItems(ORIGIN);
	if (PHOENIX_API_ORIGIN) {
		const discovered: DiscoveryEntry[] = [];
		let cursor: string | null = null;
		const seenCursors = new Set<string>();
		let pages = 0;
		try {
			do {
				if (++pages > MAX_PAGES) throw new Error('Discovery exceeded 500 pages');
				const query = new URLSearchParams({ limit: '200' });
				if (cursor) query.set('cursor', cursor);
				const payload = await apiRequest<unknown>(`/content/discovery?${query}`, {
					fetcher: fetch
				});
				const page = parseDiscoveryPage(payload);
				if (!page) throw new Error('Invalid discovery page');
				for (const entry of page.items) {
					const item = contentSitemapItem(ORIGIN, entry);
					if (!item) throw new Error('Invalid discovery URL');
					items.push(item);
					discovered.push(entry);
				}
				if (items.length > MAX_URLS) throw new Error('Sitemap exceeds 50,000 URLs');
				cursor = page.nextCursor;
				if (cursor) {
					if (seenCursors.has(cursor)) throw new Error('Repeated discovery cursor');
					seenCursors.add(cursor);
				}
			} while (cursor);
			items.push(...contentListSitemapItems(ORIGIN, discovered));
		} catch {
			return new Response('Sitemap discovery is unavailable', { status: 503 });
		}
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
