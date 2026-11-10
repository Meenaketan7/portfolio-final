<script lang="ts">
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import StoreProvider from '#lib/hooks/store/store-provider.svelte';
	import GlobalProgress from '#lib/components/core/system/global-progress.svelte';
	import Controls from './global-progress-controls.svelte';

	const client = new QueryClient();
</script>

<QueryClientProvider {client}>
	<StoreProvider>
		<GlobalProgress />
		<Controls />
	</StoreProvider>
</QueryClientProvider>
