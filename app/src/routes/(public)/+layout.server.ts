import { ORIGIN } from '$app/env/private';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => ({ siteOrigin: ORIGIN ?? null });
