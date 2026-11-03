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
		'typescript/no-explicit-any': 'error'
	},
	env: {
		builtin: true
	},
	globals: {},
	ignorePatterns: ['**/node_modules/**', '**/dist/**']
});
