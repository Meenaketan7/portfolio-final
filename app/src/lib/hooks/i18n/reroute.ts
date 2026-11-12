import type { Reroute } from '@sveltejs/kit/hooks';
import { deLocalizeUrl } from '#lib/paraglide/runtime.js';

export const reroute: Reroute = ({ url }) => {
	if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return url.pathname;
	const path = deLocalizeUrl(url).pathname;
	return path === '/api' || path.startsWith('/api/') ? url.pathname : path;
};
