import { describe, expect, it } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { handle } from '#lib/hooks/i18n/handle.server.js';
import { reroute } from '#lib/hooks/i18n/reroute.js';
import {
	deLocalizeUrl,
	extractLocaleFromUrl,
	localizeHref,
	type Locale
} from '#lib/paraglide/runtime.js';
import { paraglideMiddleware } from '#lib/paraglide/server.js';

const localePaths = [
	['en', ''],
	['es', '/es'],
	['pt-br', '/pt-br'],
	['de', '/de'],
	['fr', '/fr'],
	['ja', '/ja']
] as const satisfies ReadonlyArray<readonly [Locale, string]>;

describe('locale URL policy', () => {
	it.each(localePaths)('%s has a stable URL for home and nested pages', (locale, prefix) => {
		const home = prefix || '/';
		const about = `${prefix}/about`;

		expect(localizeHref('/', { locale })).toBe(home);
		expect(localizeHref('/about', { locale })).toBe(about);
		expect(extractLocaleFromUrl(new URL(about, 'https://example.test'))).toBe(locale);
		expect(deLocalizeUrl(new URL(about, 'https://example.test')).pathname).toBe('/about');
	});

	it('keeps the English root stable when preferences request another language', async () => {
		const request = new Request('https://example.test/', {
			headers: {
				accept: 'text/html',
				'accept-language': 'es',
				cookie: 'PARAGLIDE_LOCALE=ja'
			}
		});
		const response = await paraglideMiddleware(request, ({ locale }) => new Response(locale));

		expect(response.status).toBe(200);
		expect(await response.text()).toBe('en');
	});

	it.each([
		['/api/v1/content/posts/post', '/api/v1/content/posts/post'],
		['/ja/api/v1/content/posts/post', '/ja/api/v1/content/posts/post'],
		['/en/api/v1/content/posts/post', '/en/api/v1/content/posts/post'],
		['/ja/about', '/about']
	])('reroutes %s only when it is a public page', async (incoming, expected) => {
		const path = await reroute({ url: new URL(incoming, 'https://example.test'), fetch });
		expect(path).toBe(expected);
	});

	it.each(['/en/api/v1/content/posts/post', '/en//api/v1/content/posts/post'])(
		'does not redirect the API alias %s',
		async (incoming) => {
			const event = { url: new URL(incoming, 'https://example.test') } as Parameters<
				typeof handle
			>[0]['event'];
			const response = await handle({
				event,
				resolve: async () => new Response('unmatched', { status: 404 })
			});
			expect(response.status).toBe(404);
		}
	);

	it.each([
		['/en', '/'],
		['/en/about?ref=old', '/about?ref=old'],
		['/en//evil.example', '/evil.example']
	])('redirects the old English URL %s to %s', async (oldPath, newPath) => {
		const event = {
			url: new URL(oldPath, 'https://example.test')
		} as Parameters<typeof handle>[0]['event'];
		let result: unknown;

		try {
			await handle({ event, resolve: async () => new Response('unexpected') });
		} catch (error) {
			result = error;
		}

		expect(isRedirect(result)).toBe(true);
		expect(result).toMatchObject({ status: 308, location: newPath });
	});
});
