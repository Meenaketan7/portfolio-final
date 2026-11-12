import { locales, type Locale } from '#lib/paraglide/runtime.js';
import type { SeoImage } from '#lib/seo/types.js';
import type {
	ContentBlock,
	ContentKind,
	DiscoveryEntry,
	PublishedRecord,
	PublishedSummary
} from './types.js';

const kinds = ['page', 'post', 'project'] as const;

const object = (value: unknown): value is Record<string, unknown> =>
	value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string =>
	typeof value === 'string' && value.trim().length > 0;
const locale = (value: unknown): value is Locale =>
	typeof value === 'string' && locales.some((item) => item === value);
const kind = (value: unknown): value is ContentKind =>
	typeof value === 'string' && kinds.some((item) => item === value);
const slug = (value: unknown): value is string => {
	if (
		!text(value) ||
		value.length > 200 ||
		value.trim() !== value ||
		/[\\/?#\s]/.test(value) ||
		[...value].some(
			(character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
		) ||
		value === '.' ||
		value === '..'
	)
		return false;
	try {
		encodeURIComponent(value);
		return true;
	} catch {
		return false;
	}
};
const cursor = (value: unknown): value is string | null =>
	value === null || (text(value) && value.length <= 500);
const timestamp = (value: unknown): value is string =>
	typeof value === 'string' &&
	/^\d{4}-\d\d-\d\dT.*Z$/.test(value) &&
	!Number.isNaN(Date.parse(value));
const image = (value: unknown): value is SeoImage | null => {
	if (value === null) return true;
	if (!object(value) || !text(value.url) || !text(value.alt)) return false;
	if (value.url.startsWith('/') && !value.url.startsWith('//') && !value.url.includes('\\'))
		return true;
	try {
		const url = new URL(value.url);
		return url.protocol === 'https:' && !url.username && !url.password;
	} catch {
		return false;
	}
};

const summary = (value: unknown): value is PublishedSummary =>
	object(value) &&
	text(value.id) &&
	kind(value.kind) &&
	locale(value.locale) &&
	slug(value.slug) &&
	text(value.title) &&
	text(value.summary) &&
	image(value.image) &&
	timestamp(value.publishedAt) &&
	timestamp(value.updatedAt);

const block = (value: unknown): value is ContentBlock => {
	if (!object(value)) return false;
	if (value.type === 'heading') return [2, 3].includes(value.level as number) && text(value.text);
	if (value.type === 'paragraph') return text(value.text);
	if (value.type === 'unorderedList')
		return Array.isArray(value.items) && value.items.length > 0 && value.items.every(text);
	return false;
};

const translations = (value: unknown): value is PublishedRecord['translations'] =>
	object(value) &&
	Object.entries(value).every(
		([key, entry]) =>
			locale(key) && object(entry) && slug(entry.slug) && typeof entry.indexable === 'boolean'
	);

export function parsePublishedRecord(
	value: unknown,
	expectedKind: ContentKind,
	expectedLocale: Locale
): PublishedRecord | null {
	if (!summary(value) || value.kind !== expectedKind || value.locale !== expectedLocale)
		return null;
	const details = value as unknown as Record<string, unknown>;
	if (
		!Array.isArray(details.bodyBlocks) ||
		!details.bodyBlocks.length ||
		!details.bodyBlocks.every(block)
	)
		return null;
	if (
		details.author !== null &&
		(!object(details.author) ||
			!text(details.author.name) ||
			(details.author.url !== undefined && !text(details.author.url)))
	)
		return null;
	if (expectedKind === 'post' && details.author === null) return null;
	if (
		!object(details.seo) ||
		!text(details.seo.title) ||
		!text(details.seo.description) ||
		!image(details.seo.image) ||
		typeof details.seo.indexable !== 'boolean' ||
		!translations(details.translations)
	)
		return null;
	const self = details.translations[expectedLocale];
	if (!self || self.slug !== value.slug || self.indexable !== details.seo.indexable) return null;
	return value as PublishedRecord;
}

export function parsePublishedList(
	value: unknown,
	expectedKind: ContentKind,
	expectedLocale: Locale
): { items: PublishedSummary[]; nextCursor: string | null } | null {
	if (!object(value) || !Array.isArray(value.items) || value.items.length > 20) return null;
	if (!cursor(value.nextCursor)) return null;
	if (
		!value.items.every(
			(entry) => summary(entry) && entry.kind === expectedKind && entry.locale === expectedLocale
		)
	)
		return null;
	return { items: value.items, nextCursor: value.nextCursor };
}

export function parseDiscoveryPage(
	value: unknown
): { items: DiscoveryEntry[]; nextCursor: string | null } | null {
	if (!object(value) || !Array.isArray(value.items) || value.items.length > 200) return null;
	if (!cursor(value.nextCursor)) return null;
	for (const entry of value.items) {
		if (
			!object(entry) ||
			!kind(entry.kind) ||
			!locale(entry.locale) ||
			!slug(entry.slug) ||
			!timestamp(entry.updatedAt) ||
			!translations(entry.translations)
		)
			return null;
		const self = entry.translations[entry.locale];
		if (!self || self.slug !== entry.slug || !self.indexable) return null;
	}
	return { items: value.items as DiscoveryEntry[], nextCursor: value.nextCursor };
}
