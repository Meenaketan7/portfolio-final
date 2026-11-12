import type { Locale } from '#lib/paraglide/runtime.js';
import type { SeoImage } from '#lib/seo/types.js';

export type ContentKind = 'page' | 'post' | 'project';
export type ContentBlock =
	| { type: 'heading'; level: 2 | 3; text: string }
	| { type: 'paragraph'; text: string }
	| { type: 'unorderedList'; items: string[] };

export type PublishedSummary = {
	id: string;
	kind: ContentKind;
	locale: Locale;
	slug: string;
	title: string;
	summary: string;
	image: SeoImage | null;
	publishedAt: string;
	updatedAt: string;
};

export type PublishedRecord = PublishedSummary & {
	bodyBlocks: ContentBlock[];
	author: { name: string; url?: string } | null;
	seo: {
		title: string;
		description: string;
		image: SeoImage | null;
		indexable: boolean;
	};
	translations: Partial<Record<Locale, { slug: string; indexable: boolean }>>;
};

export type DiscoveryEntry = {
	kind: ContentKind;
	locale: Locale;
	slug: string;
	updatedAt: string;
	translations: PublishedRecord['translations'];
};
