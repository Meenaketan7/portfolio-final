import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import LanguageSwitcher from '#lib/components/core/language-switcher.svelte';

describe('LanguageSwitcher', () => {
	it('offers the configured languages with an accessible label', async () => {
		await render(LanguageSwitcher);

		await expect.element(page.getByRole('combobox', { name: 'Language' })).toBeInTheDocument();
		await expect
			.element(page.getByRole('option', { name: 'English' }))
			.toHaveAttribute('lang', 'en');
		await expect
			.element(page.getByRole('option', { name: '日本語' }))
			.toHaveAttribute('lang', 'ja');
		await expect
			.element(page.getByRole('option', { name: 'Português (Brasil)' }))
			.toHaveAttribute('lang', 'pt-br');
	});
});
