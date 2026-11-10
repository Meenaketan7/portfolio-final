import type { Handle } from '@sveltejs/kit/hooks';

export type RouteAccess = 'public' | 'private' | 'user' | 'admin';
export type AccessDecision = 'allow' | 'unauthenticated' | 'forbidden';

export function routeAccess(routeId: string | null): RouteAccess {
	const segments = routeId?.split('/') ?? [];

	if (segments.includes('(admin)')) return 'admin';
	if (segments.includes('(user)')) return 'user';
	if (segments.includes('(private)')) return 'private';
	return 'public';
}

export function accessDecision(access: RouteAccess, user: App.Locals['user']): AccessDecision {
	if (access === 'public') return 'allow';
	if (!user?.id) return 'unauthenticated';
	if (access === 'private' || user.role === access) return 'allow';
	return 'forbidden';
}

export const handleAccess: Handle = ({ event, resolve }) => {
	const decision = accessDecision(routeAccess(event.route.id), event.locals.user);
	const headers = {
		'content-type': 'text/plain; charset=utf-8',
		'cache-control': 'no-store'
	};

	if (decision === 'unauthenticated') {
		return new Response('Authentication required', { status: 401, headers });
	}
	if (decision === 'forbidden') {
		return new Response('Forbidden', { status: 403, headers });
	}

	return resolve(event);
};
