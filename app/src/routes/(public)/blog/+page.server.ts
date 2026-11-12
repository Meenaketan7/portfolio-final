import type { PageServerLoad } from './$types';
import { extractLocaleFromUrl } from '#lib/paraglide/runtime.js';
import { m } from '#lib/paraglide/messages.js';
import { loadPublishedList } from '#lib/hooks/api/content/public-content.server.js';

export const load: PageServerLoad = ({ url, fetch }) => {
	const locale = extractLocaleFromUrl(url);
	return loadPublishedList('post', url, fetch, {
		title: m.blog_title({}, { locale }),
		description: m.blog_description({}, { locale })
	});
};
