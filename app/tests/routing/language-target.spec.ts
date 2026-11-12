import { describe, expect, it } from 'vitest';
import { languageTarget } from '#lib/components/core/language-target.js';

describe('language target for published content', () => {
	it('uses the translated slug when one is published', () => {
		expect(
			languageTarget('ja', '/blog/hello', {
				en: '/blog/hello',
				ja: '/ja/blog/konnichiwa'
			})
		).toBe('/ja/blog/konnichiwa');
	});

	it('returns to the selected language home when no translation exists', () => {
		expect(languageTarget('es', '/blog/hello', { en: '/blog/hello' })).toBe('/es');
	});

	it('keeps ordinary static paths when no translation map exists', () => {
		expect(languageTarget('de', '/about')).toBe('/de/about');
	});
});
