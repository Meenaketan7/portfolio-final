import type { Locale } from '#lib/paraglide/runtime.js';

export type SeoImage = {
	/** Root-relative path or absolute HTTPS URL of a publicly accessible image. */
	url: string;
	alt: string;
};

export type SeoData = {
	title: string;
	description: string;
	image?: SeoImage;
	type?: 'website' | 'article';
	/** Only published translations; each language must advertise the same set. */
	alternates?: Partial<Record<Locale, string>>;
	/** Must describe content visible on this page. */
	structuredData?: Record<string, unknown>;
	noindex?: boolean;
};
