import { defineConfig } from '@inlang/paraglide-js';
const locales = ['en', 'es', 'pt-br', 'de', 'fr', 'ja'] as const;

const localePaths = (suffix: string) =>
	locales.map((locale): [string, string] => [locale, `/${locale}${suffix}`]);

export default defineConfig({
	outdir: './src/lib/paraglide',
	emitTsDeclarations: true,
	strategy: ['url', 'cookie', 'preferredLanguage', 'baseLocale'],
	urlPatterns: [
		{ pattern: '/', localized: localePaths('') },
		{ pattern: '/:path(.*)?', localized: localePaths('/:path(.*)?') }
	]
});
