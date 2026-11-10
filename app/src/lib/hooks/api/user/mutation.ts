import { mutationOptions } from '@tanstack/svelte-query';
import { userPath, type UserId } from './type.js';
import { apiRequest } from '#config/index.js';

export const userMutations = {
	create: <TResponse = unknown, TInput = unknown>(fetcher?: typeof fetch) =>
		mutationOptions({
			mutationFn: (data: TInput) =>
				apiRequest<TResponse>(userPath, { method: 'POST', data, fetcher })
		}),
	update: <TResponse = unknown, TInput = unknown>(fetcher?: typeof fetch) =>
		mutationOptions({
			mutationFn: ({ id, data }: { id: UserId; data: TInput }) =>
				apiRequest<TResponse>(`${userPath}/${encodeURIComponent(id)}`, {
					method: 'PATCH',
					data,
					fetcher
				})
		}),
	remove: (fetcher?: typeof fetch) =>
		mutationOptions({
			mutationFn: (id: UserId) =>
				apiRequest<void>(`${userPath}/${encodeURIComponent(id)}`, {
					method: 'DELETE',
					fetcher
				})
		})
};
