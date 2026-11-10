import { describe, expect, it } from 'vitest';
import { variables } from '#config/env/env-config.js';

const validateApiPath = (value: string | undefined) =>
	variables.API_BASE_PATH.schema['~standard'].validate(value);
const validatePhoenixOrigin = (value: string | undefined) =>
	variables.PHOENIX_API_ORIGIN.schema['~standard'].validate(value);

describe('environment variables', () => {
	it('defaults and validates the same-origin API base path', async () => {
		expect(await validateApiPath(undefined)).toEqual({ value: '/api/v1' });
		expect(await validateApiPath(' /api/v2 ')).toEqual({ value: '/api/v2' });
		expect(await validateApiPath('https://other.example/api')).toHaveProperty('issues');
		expect(await validateApiPath('//other.example/api')).toHaveProperty('issues');
	});

	it('keeps the Phoenix origin private and rejects paths or credentials', async () => {
		expect(await validatePhoenixOrigin(undefined)).toEqual({ value: undefined });
		expect(await validatePhoenixOrigin('https://api.example.com/')).toEqual({
			value: 'https://api.example.com'
		});
		expect(await validatePhoenixOrigin('https://api.example.com/v1')).toHaveProperty('issues');
		expect(await validatePhoenixOrigin('https://user:pass@api.example.com')).toHaveProperty(
			'issues'
		);
		expect(await validatePhoenixOrigin('ftp://api.example.com')).toHaveProperty('issues');
	});
});
