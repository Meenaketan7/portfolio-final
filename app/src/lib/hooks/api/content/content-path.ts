import { localizeHref, type Locale } from '#lib/paraglide/runtime.js';
import type { ContentKind } from './types.js';

const routes: Record<ContentKind, string> = {
	page: 'pages',
	post: 'blog',
	project: 'projects'
};

export function contentPath(kind: ContentKind, locale: Locale, slug: string): string {
	return localizeHref(`/${routes[kind]}/${encodeURIComponent(slug)}`, { locale });
}

export function contentListPath(kind: Exclude<ContentKind, 'page'>, locale: Locale): string {
	return localizeHref(`/${routes[kind]}`, { locale });
}
