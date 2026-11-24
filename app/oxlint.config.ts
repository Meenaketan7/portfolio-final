import { defineConfig } from 'oxlint';

export default defineConfig({
	plugins: ['typescript'],

	categories: {
		correctness: 'error',
		suspicious: 'warn'
	},
	rules: {
		'eslint/no-unused-vars': 'error',
		'eslint/no-console': ['error', { allow: ['warn', 'error'] }],
		'typescript/no-explicit-any': 'error',
		// `_tag` is the discriminant of Effect's tagged errors and data types
		'eslint/no-underscore-dangle': ['warn', { allow: ['_tag'] }]
	},
	env: {
		builtin: true
	},
	globals: {},
	ignorePatterns: ['**/node_modules/**', '**/dist/**']
});
