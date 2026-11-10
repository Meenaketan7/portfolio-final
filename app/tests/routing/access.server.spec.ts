import { describe, expect, it, vi } from 'vitest';
import {
	accessDecision,
	handleAccess,
	routeAccess
} from '../../src/routes/middlewares/access.server.js';

type HookEvent = Parameters<typeof handleAccess>[0]['event'];

function event(routeId: string, user?: App.Locals['user']): HookEvent {
	return { route: { id: routeId }, locals: { user } } as HookEvent;
}

describe('route access', () => {
	it('leaves public pages and API routes open', () => {
		expect(routeAccess('/(public)/about')).toBe('public');
		expect(routeAccess('/api/[...path]')).toBe('public');
		expect(accessDecision('public', undefined)).toBe('allow');
	});

	it('requires a verified user for private routes', () => {
		expect(routeAccess('/(private)/settings')).toBe('private');
		expect(accessDecision('private', undefined)).toBe('unauthenticated');
		expect(accessDecision('private', { id: '1', role: 'user' })).toBe('allow');
	});

	it('keeps user and admin routes separate', () => {
		expect(routeAccess('/(private)/(user)/home')).toBe('user');
		expect(routeAccess('/(private)/(admin)/dashboard')).toBe('admin');
		expect(routeAccess('/(admin)/settings')).toBe('admin');
		expect(accessDecision('user', { id: '1', role: 'admin' })).toBe('forbidden');
		expect(accessDecision('admin', { id: '1', role: 'user' })).toBe('forbidden');
		expect(accessDecision('admin', { id: '1', role: 'admin' })).toBe('allow');
	});

	it('blocks unauthenticated page requests before loading the page', async () => {
		const resolve = vi.fn(async () => new Response('page'));
		const response = await handleAccess({
			event: event('/(private)/(user)/home'),
			resolve
		});

		expect(response.status).toBe(401);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.text()).toBe('Authentication required');
		expect(resolve).not.toHaveBeenCalled();
	});

	it('blocks the wrong role and allows the correct role', async () => {
		const resolve = vi.fn(async () => new Response('page'));
		const wrongRole = await handleAccess({
			event: event('/(private)/(admin)/dashboard', { id: '1', role: 'user' }),
			resolve
		});
		expect(wrongRole.status).toBe(403);
		expect(resolve).not.toHaveBeenCalled();

		const allowed = await handleAccess({
			event: event('/(private)/(admin)/dashboard', { id: '2', role: 'admin' }),
			resolve
		});
		expect(allowed.status).toBe(200);
		expect(resolve).toHaveBeenCalledOnce();
	});
});
