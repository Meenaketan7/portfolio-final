import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import { createPersistentStore, createSessionStore } from '#lib/hooks/store/create-store.js';

const isCount = (value: unknown): value is { count: number } =>
	typeof value === 'object' &&
	value !== null &&
	'count' in value &&
	typeof value.count === 'number';

describe('state stores', () => {
	it('isolates temporary state between instances', () => {
		const first = createSessionStore({ count: 0 });
		const second = createSessionStore({ count: 0 });

		first.update(({ count }) => ({ count: count + 1 }));
		expect(get(first)).toEqual({ count: 1 });
		expect(get(second)).toEqual({ count: 0 });
		first.reset();
		expect(get(first)).toEqual({ count: 0 });
	});

	it('hydrates persisted state only when started and saves updates', () => {
		const storage = {
			getItem: vi.fn(() => JSON.stringify({ count: 3 })),
			setItem: vi.fn()
		} as unknown as Storage;
		const state = createPersistentStore('test:counter', { count: 0 }, isCount);

		expect(get(state)).toEqual({ count: 0 });
		const stop = state.start(storage);
		expect(get(state)).toEqual({ count: 3 });
		state.set({ count: 4 });
		expect(storage.setItem).toHaveBeenCalledWith('test:counter', '{"count":4}');
		stop();
	});

	it('ignores invalid saved data and remains writable', () => {
		const storage = {
			getItem: vi.fn(() => '{invalid'),
			setItem: vi.fn()
		} as unknown as Storage;
		const state = createPersistentStore('test:counter', { count: 0 }, isCount);

		state.start(storage);
		state.set({ count: 2 });
		expect(get(state)).toEqual({ count: 2 });
		expect(storage.setItem).toHaveBeenCalledWith('test:counter', '{"count":2}');
	});

	it('keeps in-memory state usable when browser storage is blocked', () => {
		const storage = {
			getItem: vi.fn(() => {
				throw new Error('Storage blocked');
			}),
			setItem: vi.fn(() => {
				throw new Error('Storage blocked');
			})
		} as unknown as Storage;
		const state = createPersistentStore('test:counter', { count: 0 }, isCount);

		const stop = state.start(storage);
		state.set({ count: 7 });
		expect(get(state)).toEqual({ count: 7 });
		stop();
	});
});
