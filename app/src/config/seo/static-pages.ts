import type { Locale } from '#lib/paraglide/runtime.js';

/** Register a page only after it has real localized content and complete page SEO. */
export const staticPublicPages: ReadonlyArray<{
	path: `/${string}`;
	locales: readonly Locale[];
	lastmod?: string;
}> = [];
