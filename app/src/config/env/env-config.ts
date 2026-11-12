import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	ORIGIN: {
		description: 'Trusted public origin for SSR, canonical URLs, and the Node adapter.',
		schema: (value) => {
			if (!value?.trim()) return undefined;
			let url: URL;
			try {
				url = new URL(value);
			} catch {
				throw new Error('ORIGIN must be an absolute HTTPS origin');
			}
			const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
			if (
				(url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
				url.pathname !== '/' ||
				url.search ||
				url.hash ||
				url.username ||
				url.password
			) {
				throw new Error('ORIGIN must be an HTTPS origin (HTTP is allowed for localhost)');
			}
			return url.origin;
		}
	},
	API_BASE_PATH: {
		public: true,
		description: 'Same-origin path used by the browser API client.',
		schema: (value) => {
			const path = value?.trim() || '/api/v1';
			if (!/^\/api(?:\/[a-zA-Z0-9_-]+)+$/.test(path)) {
				throw new Error('API_BASE_PATH must be a path such as /api/v1');
			}
			return path;
		}
	},
	PHOENIX_API_ORIGIN: {
		description: 'Private origin of the Phoenix server used by the API proxy.',
		schema: (value) => {
			if (!value?.trim()) return undefined;
			let url: URL;
			try {
				url = new URL(value);
			} catch {
				throw new Error('PHOENIX_API_ORIGIN must be an absolute HTTP(S) origin');
			}
			if (
				!['http:', 'https:'].includes(url.protocol) ||
				url.pathname !== '/' ||
				url.search ||
				url.hash ||
				url.username ||
				url.password
			) {
				throw new Error('PHOENIX_API_ORIGIN must be an absolute HTTP(S) origin');
			}
			return url.origin;
		}
	}
});
