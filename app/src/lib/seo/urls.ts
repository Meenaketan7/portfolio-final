import type { Locale } from '#lib/paraglide/runtime.js';

export const HREFLANG: Record<Locale, string> = {
	en: 'en',
	es: 'es',
	'pt-br': 'pt-BR',
	de: 'de',
	fr: 'fr',
	ja: 'ja'
};

export function localPageUrl(origin: string, path: string): string | null {
	if (!path.startsWith('/') || path.startsWith('//') || path.includes('?') || path.includes('#')) {
		return null;
	}
	try {
		const url = new URL(path, origin);
		return url.origin === origin ? url.href : null;
	} catch {
		return null;
	}
}

export function imageUrl(origin: string, value: string): string | null {
	try {
		const url = new URL(value, origin);
		if (url.username || url.password) return null;
		if (url.origin === origin || url.protocol === 'https:') return url.href;
	} catch {
		// Invalid image URL: omit the social image instead of emitting a broken tag.
	}
	return null;
}

export function safeJsonLd(value: Record<string, unknown>): string | null {
	try {
		return JSON.stringify(value).replace(
			/[<>&\u2028\u2029]/g,
			(character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
		);
	} catch {
		return null;
	}
}

/** The JSON is escaped before it is inserted as raw script markup. */
export function jsonLdScript(value: Record<string, unknown>): string | null {
	const json = safeJsonLd(value);
	return json ? `<script type="application/ld+json">${json}</script>` : null;
}
