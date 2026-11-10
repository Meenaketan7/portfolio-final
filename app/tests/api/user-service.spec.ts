import { QueryClient } from '@tanstack/svelte-query';
import { describe, expect, it, vi } from 'vitest';
import { userMutations, userQueries } from '#lib/hooks/api/user/index.js';

describe('user API service', () => {
	it('uses separate query keys and URL-encodes detail IDs', async () => {
		const fetcher = vi.fn(async (_input: RequestInfo | URL) => Response.json({ id: 'a b' }));
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const list = userQueries.list<{ id: string }>(fetcher);
		const detail = userQueries.detail<{ id: string }>('a b', fetcher);

		await client.fetchQuery(list);
		await client.fetchQuery(detail);

		expect(list.queryKey).toEqual(['user', 'list']);
		expect(detail.queryKey).toEqual(['user', 'detail', 'a b']);
		expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
			'/api/v1/user',
			'/api/v1/user/a%20b'
		]);
	});

	it('uses the expected methods and encoded IDs for mutations', async () => {
		const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			Response.json({ ok: true })
		);
		const client = new QueryClient();
		await client
			.getMutationCache()
			.build(client, userMutations.create<{ ok: boolean }, { name: string }>(fetcher))
			.execute({ name: 'Ada' });
		await client
			.getMutationCache()
			.build(client, userMutations.update<{ ok: boolean }, { name: string }>(fetcher))
			.execute({ id: 'a b', data: { name: 'Grace' } });
		await client.getMutationCache().build(client, userMutations.remove(fetcher)).execute('a b');

		expect(fetcher.mock.calls.map(([url, options]) => [String(url), options?.method])).toEqual([
			['/api/v1/user', 'POST'],
			['/api/v1/user/a%20b', 'PATCH'],
			['/api/v1/user/a%20b', 'DELETE']
		]);
	});
});
