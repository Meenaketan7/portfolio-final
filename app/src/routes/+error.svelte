<script lang="ts">
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { ErrorScreen } from '#lib/components/screen-components/error/index.js';
	import { m } from '#lib/paraglide/messages.js';
	import { localizeHref } from '#lib/paraglide/runtime.js';

	let title = $derived(
		page.status === 404
			? m.error_not_found()
			: page.status === 500
				? m.error_server()
				: m.error_generic()
	);
	let description = $derived(
		page.status === 404
			? m.error_not_found_description()
			: page.status === 500
				? m.error_server_description()
				: m.error_generic_description()
	);

	$effect(() => {
		const id = `route-error:${page.status}:${page.url.pathname}`;
		const message = title;
		untrack(() => toast.error(message, { id }));
	});
</script>

<ErrorScreen
	status={page.status}
	{title}
	{description}
	homeHref={localizeHref('/')}
	homeLabel={m.error_home()}
	retryLabel={page.status === 404 ? undefined : m.error_retry()} />
