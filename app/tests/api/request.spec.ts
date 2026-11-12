import { describe, expect, it, vi } from 'vitest';
import { ApiError, ApiNetworkError, apiRequest } from '#config/api/request.js';

describe('apiRequest', () => {
	it('uses the same-origin API path and sends JSON with injected fetch', async () => {
		const fetcher = vi.fn(async () => Response.json({ id: '42' }));
		const result = await apiRequest<{ id: string }>('/user', {
			method: 'POST',
			data: { name: 'Ada' },
			fetcher
		});

		expect(result).toEqual({ id: '42' });
		expect(fetcher).toHaveBeenCalledWith(
			'/api/v1/user',
			expect.objectContaining({
				method: 'POST',
				credentials: 'same-origin',
				body: JSON.stringify({ name: 'Ada' })
			})
		);
	});

	it('keeps response details on HTTP errors', async () => {
		const fetcher = vi.fn(async () => Response.json({ message: 'Unauthorized' }, { status: 401 }));

		await expect(apiRequest('/user', { fetcher })).rejects.toMatchObject<ApiError>({
			name: 'ApiError',
			status: 401,
			message: 'Unauthorized',
			details: { message: 'Unauthorized' }
		});
	});

	it('rejects paths outside the configured API base', async () => {
		await expect(apiRequest('//other-host')).rejects.toThrow(TypeError);
	});

	it('returns no body for a successful 204 response', async () => {
		const fetcher = vi.fn(async () => new Response(null, { status: 204 }));

		await expect(apiRequest('/user', { fetcher })).resolves.toBeUndefined();
	});

	it('preserves custom headers and an abort signal', async () => {
		const controller = new AbortController();
		const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			const headers = new Headers(init?.headers);
			expect(headers.get('x-request-id')).toBe('test-123');
			expect(headers.get('accept')).toBe('application/json');
			expect(init?.signal).toBe(controller.signal);
			return Response.json({ ok: true });
		});

		await expect(
			apiRequest('/user', {
				fetcher,
				signal: controller.signal,
				headers: { 'x-request-id': 'test-123' }
			})
		).resolves.toEqual({ ok: true });
	});

	it('uses an explicit locale for content without adding one to generic requests', async () => {
		const requests: Array<{ path: string; language: string | null }> = [];
		const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			requests.push({
				path: String(input),
				language: new Headers(init?.headers).get('accept-language')
			});
			return Response.json({ ok: true });
		});

		await apiRequest('/content/posts/ola', {
			fetcher,
			locale: 'pt-br',
			headers: { 'accept-language': 'fr' }
		});
		await apiRequest('/content/discovery', { fetcher });

		expect(requests).toEqual([
			{ path: '/api/v1/content/posts/ola', language: 'pt-BR' },
			{ path: '/api/v1/content/discovery', language: null }
		]);
	});

	it('turns malformed JSON error responses into an ApiError', async () => {
		const fetcher = vi.fn(
			async () =>
				new Response('{broken', {
					status: 500,
					statusText: 'Server Error',
					headers: { 'content-type': 'application/json' }
				})
		);

		await expect(apiRequest('/user', { fetcher })).rejects.toMatchObject<ApiError>({
			name: 'ApiError',
			status: 500,
			message: 'Server Error',
			details: null
		});
	});

	it('reports a connection failure without treating an aborted request as offline', async () => {
		const failure = new TypeError('Failed to fetch');
		const fetcher = vi.fn(async () => {
			throw failure;
		});

		await expect(apiRequest('/user', { fetcher })).rejects.toMatchObject<ApiNetworkError>({
			name: 'ApiNetworkError',
			message: 'Unable to reach the server. Check your connection and try again.',
			cause: failure
		});

		const abort = new DOMException('Aborted', 'AbortError');
		await expect(
			apiRequest('/user', {
				fetcher: async () => {
					throw abort;
				}
			})
		).rejects.toBe(abort);
	});
});
