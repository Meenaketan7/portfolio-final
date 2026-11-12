import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { SeoHead } from '#lib/seo/index.js';

describe('public page SEO head', () => {
	it('renders page-specific metadata in server HTML', () => {
		const { head } = render(SeoHead, {
			props: {
				pathname: '/',
				siteOrigin: 'https://example.test',
				seo: {
					title: '  Portfolio & work  ',
					description: '  Projects, writing, and experience.  '
				}
			}
		});

		expect(head).toContain('<title>Portfolio &amp; work</title>');
		expect(head).toContain('name="description" content="Projects, writing, and experience."');
		expect(head.match(/<title>/g)).toHaveLength(1);
		expect(head.match(/name="description"/g)).toHaveLength(1);
		expect(head).not.toContain('name="robots"');
		expect(head).toContain('rel="canonical" href="https://example.test/"');
		expect(head).toContain('property="og:url" content="https://example.test/"');
	});

	it('does not index a page without a trusted site origin', () => {
		const { head } = render(SeoHead, {
			props: {
				pathname: '/blog/post?tracking=1',
				seo: { title: 'Post', description: 'A real post' }
			}
		});
		expect(head).toContain('name="robots" content="noindex"');
		expect(head).not.toContain('rel="canonical"');
		expect(head).not.toContain('property="og:url"');
	});

	it('uses absolute reciprocal language links and safe structured data', () => {
		const { head } = render(SeoHead, {
			props: {
				pathname: '/ja/blog/post',
				siteOrigin: 'https://example.test',
				seo: {
					title: '記事',
					description: '説明',
					type: 'article',
					image: { url: '/card.png', alt: 'カード' },
					alternates: { en: '/blog/post', ja: '/ja/blog/post', 'pt-br': '/pt-br/blog/post' },
					structuredData: {
						'@context': 'https://schema.org',
						'@type': 'BlogPosting',
						headline: '</script><script>alert(1)</script>'
					}
				}
			}
		});
		expect(head).toContain('rel="canonical" href="https://example.test/ja/blog/post"');
		expect(head).toContain('hreflang="pt-BR" href="https://example.test/pt-br/blog/post"');
		expect(head).toContain('hreflang="x-default" href="https://example.test/blog/post"');
		expect(head).toContain('property="og:image" content="https://example.test/card.png"');
		expect(head).toContain('type="application/ld+json"');
		expect(head).toContain('\\u003c/script\\u003e');
		expect(head).not.toContain('</script><script>alert(1)');
	});

	it('keeps missing or blank metadata out of the index', () => {
		for (const seo of [undefined, { title: ' ', description: 'A description' }]) {
			const { head } = render(SeoHead, { props: { seo, pathname: '/' } });

			expect(head).toContain('name="robots" content="noindex"');
			expect(head).not.toContain('<title>');
			expect(head).not.toContain('name="description"');
		}
	});

	it('supports an explicitly non-indexable page with useful metadata', () => {
		const { head } = render(SeoHead, {
			props: {
				pathname: '/',
				siteOrigin: 'https://example.test',
				seo: {
					title: '下書き',
					description: '公開前のページです。',
					noindex: true
				}
			}
		});

		expect(head).toContain('<title>下書き</title>');
		expect(head).toContain('name="description" content="公開前のページです。"');
		expect(head).toContain('name="robots" content="noindex"');
	});
});
