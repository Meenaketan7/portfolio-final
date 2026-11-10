import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import GlobalProgressHarness from './fixtures/global-progress-harness.svelte';

describe('GlobalProgress', () => {
	it('shows while tracked UI work runs and clears when it finishes', async () => {
		await render(GlobalProgressHarness);

		await page.getByRole('button', { name: 'Start UI task' }).click();
		await expect.element(page.getByRole('progressbar', { name: 'Loading' })).toBeInTheDocument();

		await page.getByRole('button', { name: 'Finish UI task' }).click();
		await expect.element(page.getByRole('progressbar')).not.toBeInTheDocument();
	});
});
