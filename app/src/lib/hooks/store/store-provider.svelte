<script lang="ts">
	import type { Snippet } from 'svelte';
	import { createNetworkStore, setNetworkContext } from './network/index.js';
	import { createUiStore, setUiContext } from './ui/index.js';

	let { children }: { children: Snippet } = $props();
	const ui = createUiStore();
	const network = createNetworkStore();

	setUiContext(ui);
	setNetworkContext(network);
</script>

{@render children()}
