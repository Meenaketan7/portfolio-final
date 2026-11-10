import type { PageServerLoad } from './$types';

// A server load makes client-side navigation request the server, where the access hook runs.
export const load: PageServerLoad = () => ({});
