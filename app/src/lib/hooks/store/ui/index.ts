import { createContext } from 'svelte';

export type UiContext = {
	state: { menuOpen: boolean };
	openMenu: () => void;
	closeMenu: () => void;
	toggleMenu: () => void;
};

export const [getUiContext, setUiContext] = createContext<UiContext>();
