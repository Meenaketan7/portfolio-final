<script lang="ts">
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import { onMount, type Snippet } from 'svelte';
	import { createQueryClient } from '#config/api/query-client.js';

	let { children }: { children: Snippet } = $props();
	const queryClient = createQueryClient();
	let Devtools: typeof import('@tanstack/svelte-query-devtools').SvelteQueryDevtools | undefined =
		$state();

	onMount(() => {
		if (!import.meta.env.DEV) return;
		void import('@tanstack/svelte-query-devtools').then(({ SvelteQueryDevtools }) => {
			Devtools = SvelteQueryDevtools;
		});
	});
</script>

<QueryClientProvider client={queryClient}>
	{@render children()}
	{#if Devtools}
		<Devtools />
	{/if}
</QueryClientProvider>
