import { onlineManager } from '@tanstack/svelte-query';
import { page } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NetworkGateHarness from './fixtures/network-gate-harness.svelte';

afterEach(() => onlineManager.setOnline(true));

describe('NetworkGate', () => {
	it('keeps loaded content usable when the connection drops', async () => {
		await render(NetworkGateHarness);
		await expect.element(page.getByText('Already loaded content')).toBeVisible();

		onlineManager.setOnline(false);
		await expect
			.element(page.getByRole('status'))
			.toHaveTextContent(
				"You're offline. Loaded pages remain available; network actions need a connection."
			);
		await expect.element(page.getByText('Already loaded content')).toBeVisible();

		onlineManager.setOnline(true);
		await expect.element(page.getByRole('status')).not.toBeInTheDocument();
	});
});
