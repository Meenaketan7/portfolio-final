import { ORIGIN } from '$app/env/private';
import { error, redirect } from '@sveltejs/kit';
import { apiRequest, ApiError, ApiNetworkError } from '#config/api/request.js';
import { extractLocaleFromUrl, type Locale } from '#lib/paraglide/runtime.js';
import { HREFLANG, imageUrl, localPageUrl } from '#lib/seo/urls.js';
import type { SeoData } from '#lib/seo/types.js';
import { parsePublishedList, parsePublishedRecord } from './contract.js';
import { contentPath } from './content-path.js';
import type { ContentKind, PublishedRecord, PublishedSummary } from './types.js';

const segments: Record<ContentKind, string> = {
	page: 'pages',
	post: 'posts',
	project: 'projects'
};
function apiFailure(reason: unknown): never {
	if (reason instanceof ApiError) {
		if (reason.status === 404 || reason.status === 410) throw error(reason.status);
		if (reason.status === 503 || reason.status === 502) throw error(reason.status);
		throw error(502, 'Content API failed');
	}
	if (reason instanceof ApiNetworkError) throw error(503, 'Content API unavailable');
	throw reason;
}

function recordSeo(record: PublishedRecord): SeoData {
	const ownPath = contentPath(record.kind, record.locale, record.slug);
	const canonical = ORIGIN ? localPageUrl(ORIGIN, ownPath) : null;
	const alternates = Object.fromEntries(
		Object.entries(record.translations)
			.filter(([, translation]) => translation?.indexable)
			.map(([locale, translation]) => [
				locale,
				contentPath(record.kind, locale as Locale, translation!.slug)
			])
	) as SeoData['alternates'];
	const socialImage = record.seo.image ?? record.image;
	const structuredData: Record<string, unknown> = {
		'@context': 'https://schema.org',
		'@type':
			record.kind === 'post'
				? 'BlogPosting'
				: record.kind === 'project'
					? 'CreativeWork'
					: 'WebPage',
		name: record.title,
		description: record.summary,
		inLanguage: HREFLANG[record.locale],
		datePublished: record.publishedAt,
		dateModified: record.updatedAt,
		mainEntityOfPage: canonical
	};
	if (record.kind === 'post') structuredData.headline = record.title;
	if (record.author) structuredData.author = { '@type': 'Person', name: record.author.name };
	if (socialImage && ORIGIN) {
		const url = imageUrl(ORIGIN, socialImage.url);
		if (url) structuredData.image = url;
	}
	return {
		title: record.seo.title,
		description: record.seo.description,
		image: socialImage ?? undefined,
		type: record.kind === 'post' ? 'article' : 'website',
		alternates,
		structuredData,
		noindex: !record.seo.indexable
	};
}

export async function loadPublishedRecord(
	kind: ContentKind,
	slug: string,
	url: URL,
	fetcher: typeof fetch
): Promise<{ record: PublishedRecord; seo: SeoData }> {
	const locale = extractLocaleFromUrl(url) ?? 'en';
	let payload: unknown;
	try {
		payload = await apiRequest<unknown>(`/content/${segments[kind]}/${encodeURIComponent(slug)}`, {
			fetcher,
			locale
		});
	} catch (reason) {
		apiFailure(reason);
	}
	const record = parsePublishedRecord(payload, kind, locale);
	if (!record) throw error(502, 'Content API returned invalid data');
	if (record.slug !== slug)
		throw redirect(308, `${contentPath(kind, locale, record.slug)}${url.search}`);
	return { record, seo: recordSeo(record) };
}

export async function loadPublishedList(
	kind: Exclude<ContentKind, 'page'>,
	url: URL,
	fetcher: typeof fetch,
	seo: Pick<SeoData, 'title' | 'description'>
): Promise<{ items: PublishedSummary[]; nextCursor: string | null; seo: SeoData }> {
	const locale = extractLocaleFromUrl(url) ?? 'en';
	const cursor = url.searchParams.get('cursor');
	if (cursor !== null && (!cursor || cursor.length > 500)) throw error(400, 'Invalid cursor');
	const params = new URLSearchParams({ limit: '20' });
	if (cursor) params.set('cursor', cursor);
	let payload: unknown;
	try {
		payload = await apiRequest<unknown>(`/content/${segments[kind]}?${params}`, {
			fetcher,
			locale
		});
	} catch (reason) {
		apiFailure(reason);
	}
	const list = parsePublishedList(payload, kind, locale);
	if (!list) throw error(502, 'Content API returned invalid data');
	return {
		...list,
		seo: { ...seo, noindex: cursor !== null || !list.items.length }
	};
}
