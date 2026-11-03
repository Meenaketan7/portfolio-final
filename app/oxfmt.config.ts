import { defineConfig } from 'oxfmt';

export default defineConfig({
	printWidth: 100,
	svelte: true,
	sortTailwindcss: {
		stylesheet: './src/themes/global.css',
		functions: ['cn']
	},
	useTabs: true,
	singleQuote: true,
	trailingComma: 'none',
	bracketSameLine: true,
	ignorePatterns: [
		'.DS_Store',
		'node_modules',
		'.env',
		'.env.*',
		'!.env.example',
		'bun.lock',
		'dist',
		'build'
	]
});
