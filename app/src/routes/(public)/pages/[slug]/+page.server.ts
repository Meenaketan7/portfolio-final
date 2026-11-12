import type { PageServerLoad } from './$types';
import { loadPublishedRecord } from '#lib/hooks/api/content/public-content.server.js';

export const load: PageServerLoad = ({ params, url, fetch }) =>
	loadPublishedRecord('page', params.slug, url, fetch);
