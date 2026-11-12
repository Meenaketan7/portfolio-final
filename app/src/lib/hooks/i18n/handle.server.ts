import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { getTextDirection } from '#lib/paraglide/runtime.js';
import { paraglideMiddleware } from '#lib/paraglide/server.js';

const handleParaglide: Handle = ({ event, resolve }) => {
	if (event.url.pathname === '/en' || event.url.pathname.startsWith('/en/')) {
		const path = `/${event.url.pathname.slice('/en'.length).replace(/^\/+/, '')}`;
		if (path === '/api' || path.startsWith('/api/')) return resolve(event);
		return redirect(308, `${path}${event.url.search}`);
	}

	return paraglideMiddleware(event.request, ({ request, locale }) => {
		return resolve(
			{ ...event, request },
			{
				transformPageChunk: ({ html }) =>
					html
						.replace('%paraglide.lang%', locale)
						.replace('%paraglide.dir%', getTextDirection(locale))
			}
		);
	});
};

export const handle: Handle = handleParaglide;
