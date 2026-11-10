import { writable } from 'svelte/store';

export function createSessionStore<T>(initialValue: T) {
	const { subscribe, set, update } = writable(initialValue);

	return {
		subscribe,
		set,
		update,
		reset: () => set(initialValue)
	};
}

export function createPersistentStore<T>(
	key: string,
	initialValue: T,
	isValid: (value: unknown) => value is T
) {
	const store = createSessionStore(initialValue);
	let stop: (() => void) | undefined;

	function start(storage?: Storage) {
		if (stop) return () => {};

		let target: Storage;
		try {
			if (!storage && typeof window === 'undefined') return () => {};
			target = storage ?? window.localStorage;
		} catch {
			// Browser storage may be unavailable; in-memory state still works.
			return () => {};
		}

		try {
			const saved = target.getItem(key);
			if (saved !== null) {
				const value: unknown = JSON.parse(saved);
				if (isValid(value)) store.set(value);
			}
		} catch {
			// Invalid saved data falls back to the server-safe default.
		}

		const unsubscribe = store.subscribe((value) => {
			try {
				target.setItem(key, JSON.stringify(value));
			} catch {
				// Storage can be blocked or full; in-memory state still works.
			}
		});
		stop = () => {
			unsubscribe();
			stop = undefined;
		};
		return stop;
	}

	return { ...store, start };
}
