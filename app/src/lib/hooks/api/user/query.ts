import { queryOptions } from '@tanstack/svelte-query';
import { apiRequest } from '#config/api/request.js';
import { userPath, type UserId } from './type.js';

export const userKeys = {
	all: ['user'] as const,
	list: () => ['user', 'list'] as const,
	detail: (id: UserId) => ['user', 'detail', id] as const
};

export const userQueries = {
	list: <TResponse = unknown>(fetcher?: typeof fetch) =>
		queryOptions({
			queryKey: userKeys.list(),
			queryFn: ({ signal }) => apiRequest<TResponse>(userPath, { fetcher, signal })
		}),
	detail: <TResponse = unknown>(id: UserId, fetcher?: typeof fetch) =>
		queryOptions({
			queryKey: userKeys.detail(id),
			queryFn: ({ signal }) =>
				apiRequest<TResponse>(`${userPath}/${encodeURIComponent(id)}`, { fetcher, signal })
		})
};
