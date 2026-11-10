import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ThemeSwitcher from '#lib/components/core/theme-switcher.svelte';

describe('ThemeSwitcher', () => {
	it('lets the user select dark mode', async () => {
		await render(ThemeSwitcher);

		await expect.element(page.getByRole('group', { name: 'Appearance' })).toBeInTheDocument();
		await page.getByRole('button', { name: 'Dark' }).click();
		await expect
			.element(page.getByRole('button', { name: 'Dark' }))
			.toHaveAttribute('aria-pressed', 'true');
	});
});
