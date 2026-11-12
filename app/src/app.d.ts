// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SeoData } from '#lib/seo/types.js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			// Set this only after verifying a session on the server.
			user?: { id: string; role: 'user' | 'admin' } | null;
		}
		interface PageData {
			seo?: SeoData;
			siteOrigin?: string | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
