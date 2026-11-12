import { defineConfig } from '@inlang/paraglide-js';
const prefixedLocales = ['es', 'pt-br', 'de', 'fr', 'ja'] as const;

const localePaths = (suffix: string) =>
	[
		...prefixedLocales.map((locale): [string, string] => [locale, `/${locale}${suffix}`]),
		['en', suffix || '/']
	] satisfies [string, string][];

export default defineConfig({
	outdir: './src/lib/paraglide',
	outputStructure: 'message-modules',
	emitTsDeclarations: true,
	strategy: ['url', 'cookie', 'preferredLanguage', 'baseLocale'],
	routeStrategies: [{ match: '/api/:path(.*)?', exclude: true }],
	urlPatterns: [
		{ pattern: '/', localized: localePaths('') },
		{ pattern: '/:path(.*)?', localized: localePaths('/:path(.*)?') }
	]
});
