import { localizeHref, type Locale } from '#lib/paraglide/runtime.js';
import type { SeoData } from '#lib/seo/types.js';

export function languageTarget(
	locale: Locale,
	pathname: string,
	alternates?: SeoData['alternates']
): string {
	return alternates
		? (alternates[locale] ?? localizeHref('/', { locale }))
		: localizeHref(pathname, { locale });
}
