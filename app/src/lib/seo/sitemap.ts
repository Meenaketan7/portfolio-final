import { localizeHref, type Locale } from '#lib/paraglide/runtime.js';
import { contentListPath, contentPath } from '#lib/hooks/api/content/content-path.js';
import type { DiscoveryEntry } from '#lib/hooks/api/content/types.js';
import { staticPublicPages } from '#config/seo/static-pages.js';
import { HREFLANG, localPageUrl } from './urls.js';

type SitemapItem = {
	url: string;
	lastmod?: string;
	alternates: { locale: string; url: string }[];
};

const xml = (value: string): string =>
	value.replace(
		/[&<>"']/g,
		(character) =>
			({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!
	);

function alternates(
	origin: string,
	paths: Partial<Record<Locale, string>>
): SitemapItem['alternates'] {
	return Object.entries(paths).flatMap(([locale, path]) => {
		const url = path && localPageUrl(origin, path);
		return url ? [{ locale: HREFLANG[locale as Locale], url }] : [];
	});
}

export function staticSitemapItems(origin: string): SitemapItem[] {
	return staticPublicPages.flatMap(({ path, locales, lastmod }) => {
		const paths = Object.fromEntries(
			locales.map((locale) => [locale, localizeHref(path, { locale })])
		) as Partial<Record<Locale, string>>;
		const translations = alternates(origin, paths);
		return translations.map(({ url }) => ({ url, lastmod, alternates: translations }));
	});
}

export function contentSitemapItem(origin: string, entry: DiscoveryEntry): SitemapItem | null {
	const url = localPageUrl(origin, contentPath(entry.kind, entry.locale, entry.slug));
	if (!url) return null;
	const paths = Object.fromEntries(
		Object.entries(entry.translations)
			.filter(([, translation]) => translation?.indexable)
			.map(([locale, translation]) => [
				locale,
				contentPath(entry.kind, locale as Locale, translation!.slug)
			])
	) as Partial<Record<Locale, string>>;
	return { url, lastmod: entry.updatedAt, alternates: alternates(origin, paths) };
}

export function contentListSitemapItems(origin: string, entries: DiscoveryEntry[]): SitemapItem[] {
	const lastmodByList = new Map<string, string>();
	for (const entry of entries) {
		if (entry.kind === 'page') continue;
		const path = contentListPath(entry.kind, entry.locale);
		const previous = lastmodByList.get(path);
		if (!previous || entry.updatedAt > previous) lastmodByList.set(path, entry.updatedAt);
	}
	return [...lastmodByList].flatMap(([path, lastmod]) => {
		const url = localPageUrl(origin, path);
		return url ? [{ url, lastmod, alternates: [] }] : [];
	});
}

export function sitemapXml(items: SitemapItem[]): string {
	const urls = items.map(({ url, lastmod, alternates: languageLinks }) => {
		const links = languageLinks
			.map(
				({ locale, url: alternateUrl }) =>
					`<xhtml:link rel="alternate" hreflang="${xml(locale)}" href="${xml(alternateUrl)}"/>`
			)
			.join('');
		const english = languageLinks.find((alternate) => alternate.locale === 'en');
		const fallback = english
			? `<xhtml:link rel="alternate" hreflang="x-default" href="${xml(english.url)}"/>`
			: '';
		return `<url><loc>${xml(url)}</loc>${lastmod ? `<lastmod>${xml(lastmod)}</lastmod>` : ''}${links}${fallback}</url>`;
	});
	return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join('')}</urlset>`;
}
