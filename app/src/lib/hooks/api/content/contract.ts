import { Option, Schema } from 'effect';
import { locales, type Locale } from '#lib/paraglide/runtime.js';

// The published content contract with Phoenix. Only server modules import this file, because
// Schema adds about 15 KB gzipped; browser code imports the derived types from ./types.js.
// Decoding drops fields the contract does not list.

const isLocale = (value: string): value is Locale => locales.some((item) => item === value);

const isControlCharacter = (character: string) => {
	const code = character.charCodeAt(0);
	return code < 32 || code === 127;
};

/** Root-relative paths, or HTTPS URLs without credentials. */
const isPublicImageUrl = (url: string) => {
	if (url.startsWith('/') && !url.startsWith('//') && !url.includes('\\')) return true;
	try {
		const parsed = new URL(url);
		return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
	} catch {
		return false;
	}
};

/** encodeURIComponent throws on lone UTF-16 surrogates. */
const isEncodable = (value: string) => {
	try {
		encodeURIComponent(value);
		return true;
	} catch {
		return false;
	}
};

/** A string with at least one non-space character. */
const Text = Schema.String.check(Schema.makeFilter((value: string) => value.trim().length > 0));

/** One URL path segment: no separators, whitespace, control characters, or dot segments. */
const Slug = Text.check(
	Schema.isMaxLength(200),
	Schema.isTrimmed(),
	Schema.makeFilter(
		(value: string) =>
			!/[\\/?#\s]/.test(value) &&
			![...value].some(isControlCharacter) &&
			value !== '.' &&
			value !== '..' &&
			isEncodable(value)
	)
);

/** A UTC ISO 8601 timestamp such as 2026-11-10T00:00:00Z. */
const Timestamp = Schema.String.check(
	Schema.makeFilter(
		(value: string) => /^\d{4}-\d\d-\d\dT.*Z$/.test(value) && !Number.isNaN(Date.parse(value))
	)
);

const Cursor = Schema.NullOr(Text.check(Schema.isMaxLength(500)));

const Image = Schema.NullOr(
	Schema.Struct({ url: Text.check(Schema.makeFilter(isPublicImageUrl)), alt: Text })
);

const Translation = Schema.Struct({ slug: Slug, indexable: Schema.Boolean });

/** Published language versions keyed by locale; any other key makes the payload invalid. */
const Translations = Schema.Record(Schema.String, Translation).pipe(
	Schema.refine((value): value is { readonly [L in Locale]?: typeof Translation.Type } =>
		Object.keys(value).every(isLocale)
	)
);

export const ContentKind = Schema.Literals(['page', 'post', 'project']);
export type ContentKind = typeof ContentKind.Type;

const ContentLocale = Schema.Literals(locales);

export const ContentBlock = Schema.Union([
	Schema.Struct({ type: Schema.Literal('heading'), level: Schema.Literals([2, 3]), text: Text }),
	Schema.Struct({ type: Schema.Literal('paragraph'), text: Text }),
	Schema.Struct({ type: Schema.Literal('unorderedList'), items: Schema.NonEmptyArray(Text) })
]);
export type ContentBlock = typeof ContentBlock.Type;

export const PublishedSummary = Schema.Struct({
	id: Text,
	kind: ContentKind,
	locale: ContentLocale,
	slug: Slug,
	title: Text,
	summary: Text,
	image: Image,
	publishedAt: Timestamp,
	updatedAt: Timestamp
});
export type PublishedSummary = typeof PublishedSummary.Type;

export const PublishedRecord = Schema.Struct({
	...PublishedSummary.fields,
	bodyBlocks: Schema.NonEmptyArray(ContentBlock),
	author: Schema.NullOr(Schema.Struct({ name: Text, url: Schema.optional(Text) })),
	seo: Schema.Struct({ title: Text, description: Text, image: Image, indexable: Schema.Boolean }),
	translations: Translations
}).check(
	// Posts need an author for their BlogPosting structured data
	Schema.makeFilter((record) => record.kind !== 'post' || record.author !== null),
	// The record's own language version must match its slug and indexing decision
	Schema.makeFilter((record) => {
		const self = record.translations[record.locale];
		return self?.slug === record.slug && self.indexable === record.seo.indexable;
	})
);
export type PublishedRecord = typeof PublishedRecord.Type;

export const DiscoveryEntry = Schema.Struct({
	kind: ContentKind,
	locale: ContentLocale,
	slug: Slug,
	updatedAt: Timestamp,
	translations: Translations
}).check(
	// Discovery lists only indexable versions, each under its own slug
	Schema.makeFilter((entry) => {
		const self = entry.translations[entry.locale];
		return self?.slug === entry.slug && self.indexable;
	})
);
export type DiscoveryEntry = typeof DiscoveryEntry.Type;

const PublishedList = Schema.Struct({
	items: Schema.Array(PublishedSummary).check(Schema.isMaxLength(20)),
	nextCursor: Cursor
});

const DiscoveryPage = Schema.Struct({
	items: Schema.Array(DiscoveryEntry).check(Schema.isMaxLength(200)),
	nextCursor: Cursor
});

const decodeRecord = Schema.decodeUnknownOption(PublishedRecord);
const decodeList = Schema.decodeUnknownOption(PublishedList);
const decodeDiscoveryPage = Schema.decodeUnknownOption(DiscoveryPage);

/** A published record of the requested kind and language, or null if the payload is invalid. */
export function parsePublishedRecord(
	value: unknown,
	expectedKind: ContentKind,
	expectedLocale: Locale
): PublishedRecord | null {
	return decodeRecord(value).pipe(
		Option.filter((record) => record.kind === expectedKind && record.locale === expectedLocale),
		Option.getOrNull
	);
}

/** One page of a published list in the requested kind and language, or null if invalid. */
export function parsePublishedList(
	value: unknown,
	expectedKind: ContentKind,
	expectedLocale: Locale
): typeof PublishedList.Type | null {
	return decodeList(value).pipe(
		Option.filter(({ items }) =>
			items.every((item) => item.kind === expectedKind && item.locale === expectedLocale)
		),
		Option.getOrNull
	);
}

/** One page of sitemap discovery entries, or null if the payload is invalid. */
export function parseDiscoveryPage(value: unknown): typeof DiscoveryPage.Type | null {
	return Option.getOrNull(decodeDiscoveryPage(value));
}
