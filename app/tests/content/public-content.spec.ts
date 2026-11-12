import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { isHttpError, isRedirect } from '@sveltejs/kit';
import { parsePublishedRecord } from '#lib/hooks/api/content/contract.js';
import {
	loadPublishedList,
	loadPublishedRecord
} from '#lib/hooks/api/content/public-content.server.js';
import ContentArticle from '#lib/seo/content-article.svelte';

const record = {
	id: 'post-1',
	kind: 'post',
	locale: 'ja',
	slug: 'sample-post',
	title: '<script>bad</script> 試験',
	summary: '公開記事の概要',
	bodyBlocks: [
		{ type: 'heading', level: 2, text: '質問' },
		{ type: 'paragraph', text: '<img src=x onerror=alert(1)>' },
		{ type: 'unorderedList', items: ['答え', '詳しい説明'] }
	],
	author: { name: 'Author' },
	image: null,
	publishedAt: '2026-11-01T00:00:00Z',
	updatedAt: '2026-11-10T00:00:00Z',
	seo: {
		title: '試験記事',
		description: '公開記事の説明',
		image: null,
		indexable: true
	},
	translations: {
		ja: { slug: 'sample-post', indexable: true },
		en: { slug: 'sample-post-en', indexable: true }
	}
};

function fetchRecord(payload: unknown, status = 200): typeof fetch {
	return (async () => Response.json(payload, { status })) as typeof fetch;
}

describe('published content contract and SSR', () => {
	it('requests a post by slug with the page locale in Accept-Language', async () => {
		let path: string | undefined;
		let language: string | null = null;
		const fetcher: typeof fetch = async (input, init) => {
			path = String(input);
			language = new Headers(init?.headers).get('accept-language');
			return Response.json(record);
		};

		await loadPublishedRecord(
			'post',
			'sample-post',
			new URL('https://site.test/ja/blog/sample-post'),
			fetcher
		);

		expect(path).toBe('/api/v1/content/posts/sample-post');
		expect(language).toBe('ja');
	});

	it('requests a list with a standard regional language tag', async () => {
		let path: string | undefined;
		let language: string | null = null;
		const fetcher: typeof fetch = async (input, init) => {
			path = String(input);
			language = new Headers(init?.headers).get('accept-language');
			return Response.json({
				items: [
					{
						id: 'post-pt',
						kind: 'post',
						locale: 'pt-br',
						slug: 'ola',
						title: 'Olá',
						summary: 'Uma publicação',
						image: null,
						publishedAt: '2026-11-01T00:00:00Z',
						updatedAt: '2026-11-10T00:00:00Z'
					}
				],
				nextCursor: null
			});
		};

		await loadPublishedList('post', new URL('https://site.test/pt-br/blog'), fetcher, {
			title: 'Blog',
			description: 'Publicações'
		});

		expect(path).toBe('/api/v1/content/posts?limit=20');
		expect(language).toBe('pt-BR');
	});

	it('renders escaped visible text with headings and returns localized metadata', async () => {
		const result = await loadPublishedRecord(
			'post',
			'sample-post',
			new URL('https://site.test/ja/blog/sample-post'),
			fetchRecord(record)
		);
		const { body } = render(ContentArticle, { props: { record: result.record } });

		expect(result.seo.title).toBe('試験記事');
		expect(result.seo.alternates?.en).toBe('/blog/sample-post-en');
		expect(body).toContain('<h2');
		expect(body).toContain('&lt;img src=x onerror=alert(1)>');
		expect(body).not.toContain('<img src=x');
		expect(body).not.toContain('<script>bad</script>');
	});

	it('redirects a historical slug to the current localized path', async () => {
		let result: unknown;
		try {
			await loadPublishedRecord(
				'post',
				'old-post',
				new URL('https://site.test/ja/blog/old-post?ref=old'),
				fetchRecord(record)
			);
		} catch (reason) {
			result = reason;
		}
		expect(isRedirect(result)).toBe(true);
		expect(result).toMatchObject({ status: 308, location: '/ja/blog/sample-post?ref=old' });
	});

	it('preserves a definite missing response and an upstream outage', async () => {
		for (const [status, expected] of [
			[404, 404],
			[503, 503]
		] as const) {
			let result: unknown;
			try {
				await loadPublishedRecord(
					'post',
					'missing',
					new URL('https://site.test/blog/missing'),
					fetchRecord({ message: 'Unavailable' }, status)
				);
			} catch (reason) {
				result = reason;
			}
			expect(isHttpError(result)).toBe(true);
			expect(result).toMatchObject({ status: expected });
		}
	});

	it('rejects malformed, mismatched, and draft-like payloads', async () => {
		expect(parsePublishedRecord({ ...record, bodyBlocks: [] }, 'post', 'ja')).toBeNull();
		expect(parsePublishedRecord({ ...record, locale: 'en' }, 'post', 'ja')).toBeNull();
		expect(
			parsePublishedRecord({ ...record, seo: { ...record.seo, indexable: 'yes' } }, 'post', 'ja')
		).toBeNull();
		let result: unknown;
		try {
			await loadPublishedRecord(
				'post',
				'sample-post',
				new URL('https://site.test/ja/blog/sample-post'),
				fetchRecord({ ...record, bodyBlocks: [] })
			);
		} catch (reason) {
			result = reason;
		}
		expect(isHttpError(result)).toBe(true);
		expect(result).toMatchObject({ status: 502 });
	});
});
