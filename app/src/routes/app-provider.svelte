<script lang="ts">
	import type { Snippet } from 'svelte';
	import ApiProvider from '#lib/hooks/api/api-provider.svelte';
	import StoreProvider from '#lib/hooks/store/store-provider.svelte';

	let { children }: { children: Snippet } = $props();
</script>

<ApiProvider>
	<StoreProvider>
		{@render children()}
	</StoreProvider>
</ApiProvider>
