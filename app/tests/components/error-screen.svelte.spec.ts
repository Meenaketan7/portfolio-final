import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ErrorScreen from '#lib/components/screen-components/error/error-screen.svelte';

describe('ErrorScreen', () => {
	it('shows the status, message, and a way home', async () => {
		await render(ErrorScreen, {
			status: 403,
			title: 'Access denied',
			description: 'You cannot open this page.',
			homeHref: '/',
			homeLabel: 'Go home'
		});

		await expect.element(page.getByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
		await expect.element(page.getByText('HTTP 403')).toBeInTheDocument();
		await expect.element(page.getByText('You cannot open this page.')).toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/');
	});
});
