import { describe, expect, it } from 'vitest';
import { createQueryClient } from '#config/api/query-client.js';

describe('createQueryClient', () => {
	it('isolates cached data between app instances', () => {
		const first = createQueryClient();
		const second = createQueryClient();

		first.setQueryData(['current-user'], { id: 'first' });
		expect(second.getQueryData(['current-user'])).toBeUndefined();
	});
});
