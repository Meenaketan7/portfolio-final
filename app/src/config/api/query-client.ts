import { browser } from '$app/env';
import { MutationCache, onlineManager, QueryClient } from '@tanstack/svelte-query';
import { showRequestError } from './request-error';

export function createQueryClient() {
	return new QueryClient({
		mutationCache: new MutationCache({
			onError: (error, _variables, _context, mutation) => {
				if (
					browser &&
					onlineManager.isOnline() &&
					mutation.options.meta?.suppressGlobalErrorToast !== true
				) {
					showRequestError(error);
				}
			}
		}),
		defaultOptions: {
			queries: {
				enabled: browser,
				staleTime: 60_000,
				refetchOnWindowFocus: false,
				retry: 1
			}
		}
	});
}
