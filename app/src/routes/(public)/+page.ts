import type { PageLoad } from './$types';
import { m } from '#lib/paraglide/messages.js';
import { extractLocaleFromUrl } from '#lib/paraglide/runtime.js';
import { staticAlternates } from '#lib/seo/urls.js';

export const load: PageLoad = ({ url }) => {
	const locale = extractLocaleFromUrl(url) ?? 'en';
	return {
		seo: {
			title: m.home_title({}, { locale }),
			description: m.home_description({}, { locale }),
			alternates: staticAlternates('/'),
			// Placeholder content: remove this and register '/' in static-pages.ts once the page is real
			noindex: true
		}
	};
};
