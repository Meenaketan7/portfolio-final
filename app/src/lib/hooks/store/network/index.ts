import { onlineManager } from '@tanstack/svelte-query';
import { createContext } from 'svelte';
import { readable, type Readable } from 'svelte/store';

export const [getNetworkContext, setNetworkContext] = createContext<Readable<boolean>>();

export function createNetworkStore(): Readable<boolean> {
	return readable(true, (set) => {
		if (typeof window === 'undefined') return;

		// TanStack Query's default starts online until the first browser event.
		onlineManager.setOnline(window.navigator.onLine);
		set(onlineManager.isOnline());
		return onlineManager.subscribe(set);
	});
}
