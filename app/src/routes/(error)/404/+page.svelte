<script lang="ts">
	import { ErrorScreen } from '$lib/components/screen-components/error';
	import { m } from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

<ErrorScreen
	status={404}
	title={m.error_not_found()}
	description={m.error_not_found_description()}
	homeHref={localizeHref('/')}
	homeLabel={m.error_home()} />
