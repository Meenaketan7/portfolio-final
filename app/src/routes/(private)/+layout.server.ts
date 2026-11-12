import type { LayoutServerLoad } from './$types';

// Recheck the server access guard on navigation between private pages.
export const load: LayoutServerLoad = ({ url }) => {
	void url.pathname;
	return {};
};
