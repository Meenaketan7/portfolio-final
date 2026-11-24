import { describe, expect, it, vi } from 'vitest';

// The real registry starts empty; register one page published in two languages
vi.mock('#config/seo/static-pages.js', () => ({
	staticPublicPages: [{ path: '/about', locales: ['en', 'de'] }]
}));

import { staticSitemapItems } from '#lib/seo/sitemap.js';
import { staticAlternates } from '#lib/seo/urls.js';

describe('static page language versions', () => {
	it('lists the published languages of a registered page', () => {
		expect(staticAlternates('/about')).toEqual({ en: '/about', de: '/de/about' });
		expect(staticAlternates('/contact')).toBeUndefined();
	});

	it('gives the sitemap the same language versions as the page', () => {
		const items = staticSitemapItems('https://site.test');
		const pageVersions = Object.values(staticAlternates('/about') ?? {}).map(
			(path) => `https://site.test${path}`
		);

		expect(items.map((item) => item.url)).toEqual(pageVersions);
		for (const item of items) {
			expect(item.alternates.map((alternate) => alternate.url)).toEqual(pageVersions);
		}
	});
});
