import { describe, expect, it } from 'vitest';
import {
	parseDiscoveryPage,
	parsePublishedList,
	parsePublishedRecord
} from '#lib/hooks/api/content/contract.js';

const summary = (slug: string) => ({
	id: `post-${slug}`,
	kind: 'post',
	locale: 'en',
	slug,
	title: 'Title',
	summary: 'Summary',
	image: null,
	publishedAt: '2026-11-01T00:00:00Z',
	updatedAt: '2026-11-10T00:00:00Z'
});

const record = {
	...summary('hello'),
	bodyBlocks: [{ type: 'paragraph', text: 'Body' }],
	author: { name: 'Author' },
	seo: { title: 'Hello', description: 'A post', image: null, indexable: true },
	translations: { en: { slug: 'hello', indexable: true } }
};

describe('published content contract', () => {
	it('keeps only the fields the contract lists', () => {
		const parsed = parsePublishedRecord(
			{
				...record,
				draftNotes: 'internal',
				bodyBlocks: [{ type: 'paragraph', text: 'Body', level: 2 }],
				author: { name: 'Author', email: 'author@example.test' }
			},
			'post',
			'en'
		);

		expect(parsed).toEqual(record);
		expect(parsed).not.toHaveProperty('draftNotes');
	});

	it('rejects translations in a language the site does not publish', () => {
		const translations = { ...record.translations, it: { slug: 'ciao', indexable: true } };

		expect(parsePublishedRecord({ ...record, translations }, 'post', 'en')).toBeNull();
	});

	it('enforces page sizes for lists and discovery', () => {
		const items = Array.from({ length: 21 }, (_, index) => summary(`post-${index}`));
		const entry = {
			kind: 'post',
			locale: 'en',
			slug: 'hello',
			updatedAt: '2026-11-10T00:00:00Z',
			translations: { en: { slug: 'hello', indexable: true } }
		};

		expect(
			parsePublishedList({ items: items.slice(0, 20), nextCursor: null }, 'post', 'en')
		).not.toBeNull();
		expect(parsePublishedList({ items, nextCursor: null }, 'post', 'en')).toBeNull();
		expect(parseDiscoveryPage({ items: [entry], nextCursor: 'next' })).not.toBeNull();
		expect(
			parseDiscoveryPage({ items: Array.from({ length: 201 }, () => entry), nextCursor: null })
		).toBeNull();
	});
});
