import { createContext } from 'svelte';
import type { Readable } from 'svelte/store';
import { createSessionStore } from '../create-store.js';

export type UiContext = {
	state: Readable<{ menuOpen: boolean }>;
	pendingTasks: Readable<number>;
	beginTask: () => () => void;
	openMenu: () => void;
	closeMenu: () => void;
	toggleMenu: () => void;
};

export const [getUiContext, setUiContext] = createContext<UiContext>();

export function createUiStore(): UiContext {
	const state = createSessionStore({ menuOpen: false });
	const pendingTasks = createSessionStore(0);

	return {
		state,
		pendingTasks,
		beginTask: () => {
			pendingTasks.update((count) => count + 1);
			let finished = false;

			return () => {
				if (finished) return;
				finished = true;
				pendingTasks.update((count) => count - 1);
			};
		},
		openMenu: () => state.set({ menuOpen: true }),
		closeMenu: () => state.set({ menuOpen: false }),
		toggleMenu: () => state.update(({ menuOpen }) => ({ menuOpen: !menuOpen }))
	};
}
