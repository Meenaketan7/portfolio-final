<script lang="ts">
	import StoreProvider from '#lib/hooks/store/store-provider.svelte';
	import NetworkGate from '#lib/components/core/system/network-gate.svelte';
</script>

<StoreProvider>
	<NetworkGate>
		<p>Already loaded content</p>
	</NetworkGate>
</StoreProvider>
