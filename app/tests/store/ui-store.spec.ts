import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import { createUiStore } from '#lib/hooks/store/ui/index.js';

describe('UI work tracking', () => {
	it('tracks overlapping tasks and lets each task finish once', () => {
		const ui = createUiStore();
		const first = ui.beginTask();
		const second = ui.beginTask();

		expect(get(ui.pendingTasks)).toBe(2);
		first();
		first();
		expect(get(ui.pendingTasks)).toBe(1);
		second();
		expect(get(ui.pendingTasks)).toBe(0);
	});
});
