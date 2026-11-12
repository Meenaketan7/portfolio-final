import { describe, expect, it } from 'vitest';
import { contentSitemapItem, sitemapXml } from '#lib/seo/sitemap.js';
import type { DiscoveryEntry } from '#lib/hooks/api/content/types.js';

describe('public XML sitemap', () => {
	it('contains canonical URLs, only published alternates, and escaped XML', () => {
		const entry: DiscoveryEntry = {
			kind: 'post',
			locale: 'pt-br',
			slug: 'perguntas-e-respostas',
			updatedAt: '2026-11-10T00:00:00Z',
			translations: {
				en: { slug: 'questions-and-answers', indexable: true },
				'pt-br': { slug: 'perguntas-e-respostas', indexable: true },
				ja: { slug: 'draft', indexable: false }
			}
		};
		const item = contentSitemapItem('https://site.test', entry);
		expect(item).not.toBeNull();
		const body = sitemapXml([item!]);
		expect(body).toContain('<loc>https://site.test/pt-br/blog/perguntas-e-respostas</loc>');
		expect(body).toContain('hreflang="pt-BR"');
		expect(body).toContain(
			'hreflang="x-default" href="https://site.test/blog/questions-and-answers"'
		);
		expect(body).not.toContain('/ja/blog/draft');
		expect(body).toContain('<lastmod>2026-11-10T00:00:00Z</lastmod>');
	});

	it('escapes query characters in generated links', () => {
		const body = sitemapXml([{ url: 'https://site.test/?a=1&b=2', alternates: [] }]);
		expect(body).toContain('https://site.test/?a=1&amp;b=2');
	});
});
