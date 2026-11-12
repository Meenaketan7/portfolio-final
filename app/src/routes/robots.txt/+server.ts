import { ORIGIN } from '$app/env/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
	new Response(
		ORIGIN
			? `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`
			: 'User-agent: *\nDisallow: /\n',
		{
			headers: {
				'content-type': 'text/plain; charset=utf-8',
				'cache-control': 'no-store'
			}
		}
	);
