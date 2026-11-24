import { ORIGIN } from '$app/env/private';
import { error, redirect } from '@sveltejs/kit';
import { Data, Effect, Result } from 'effect';
import { apiRequestEffect, type ApiError, type ApiNetworkError } from '#config/api/request.js';
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

/** The list `cursor` query parameter is empty or too long. */
class InvalidCursor extends Data.TaggedError('InvalidCursor') {}

/** Phoenix answered with data that does not match the published content contract. */
class InvalidContent extends Data.TaggedError('InvalidContent') {}

/** The requested slug is outdated; the record now lives at `location`. */
class MovedContent extends Data.TaggedError('MovedContent')<{ readonly location: string }> {}

type ContentFailure = ApiError | ApiNetworkError | InvalidCursor | InvalidContent | MovedContent;

/** Answers a failed content request with the matching SvelteKit error or redirect. */
function respondTo(failure: ContentFailure): never {
	if (failure._tag === 'MovedContent') redirect(308, failure.location);
	if (failure._tag === 'InvalidCursor') error(400, 'Invalid cursor');
	if (failure._tag === 'InvalidContent') error(502, 'Content API returned invalid data');
	if (failure._tag === 'ApiNetworkError') error(503, 'Content API unavailable');
	if ([404, 410, 502, 503].includes(failure.status)) error(failure.status);
	error(502, 'Content API failed');
}

/**
 * Runs a content program from a `load` function. Typed failures become SvelteKit errors or
 * redirects; defects (for example an aborted request) reject unchanged.
 */
async function runContentLoad<A>(program: Effect.Effect<A, ContentFailure>): Promise<A> {
	const result = await Effect.runPromise(Effect.result(program));
	return Result.isSuccess(result) ? result.success : respondTo(result.failure);
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
	if (record.author) {
		// Google's Article guidance recommends author.url, a page that identifies the author
		structuredData.author = {
			'@type': 'Person',
			name: record.author.name,
			...(record.author.url ? { url: record.author.url } : {})
		};
	}
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

const publishedRecord = Effect.fnUntraced(function* (
	kind: ContentKind,
	slug: string,
	url: URL,
	fetcher: typeof fetch
) {
	const locale = extractLocaleFromUrl(url) ?? 'en';
	const payload = yield* apiRequestEffect<unknown>(
		`/content/${segments[kind]}/${encodeURIComponent(slug)}`,
		{ fetcher, locale }
	);
	const record = parsePublishedRecord(payload, kind, locale);
	if (!record) return yield* new InvalidContent();
	if (record.slug !== slug) {
		return yield* new MovedContent({
			location: `${contentPath(kind, locale, record.slug)}${url.search}`
		});
	}
	return { record, seo: recordSeo(record) };
});

const publishedList = Effect.fnUntraced(function* (
	kind: Exclude<ContentKind, 'page'>,
	url: URL,
	fetcher: typeof fetch,
	seo: Pick<SeoData, 'title' | 'description'>
) {
	const locale = extractLocaleFromUrl(url) ?? 'en';
	const cursor = url.searchParams.get('cursor');
	if (cursor !== null && (!cursor || cursor.length > 500)) return yield* new InvalidCursor();
	const params = new URLSearchParams({ limit: '20' });
	if (cursor) params.set('cursor', cursor);
	const payload = yield* apiRequestEffect<unknown>(`/content/${segments[kind]}?${params}`, {
		fetcher,
		locale
	});
	const list = parsePublishedList(payload, kind, locale);
	if (!list) return yield* new InvalidContent();
	return {
		...list,
		seo: { ...seo, noindex: cursor !== null || !list.items.length }
	};
});

export function loadPublishedRecord(
	kind: ContentKind,
	slug: string,
	url: URL,
	fetcher: typeof fetch
): Promise<{ record: PublishedRecord; seo: SeoData }> {
	return runContentLoad(publishedRecord(kind, slug, url, fetcher));
}

export function loadPublishedList(
	kind: Exclude<ContentKind, 'page'>,
	url: URL,
	fetcher: typeof fetch,
	seo: Pick<SeoData, 'title' | 'description'>
): Promise<{ items: readonly PublishedSummary[]; nextCursor: string | null; seo: SeoData }> {
	return runContentLoad(publishedList(kind, url, fetcher, seo));
}
