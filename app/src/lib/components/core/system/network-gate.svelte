<script lang="ts">
	import type { Snippet } from 'svelte';
	import WifiOffIcon from '@lucide/svelte/icons/wifi-off';
	import { getNetworkContext } from '#lib/hooks/store/network/index.js';
	import { m } from '#lib/paraglide/messages.js';

	let { children }: { children: Snippet } = $props();
	const online = getNetworkContext();
</script>

{#if !$online}
	<div
		role="status"
		class="fixed inset-x-4 bottom-4 z-40 mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-2 rounded-md border border-border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg">
		<WifiOffIcon aria-hidden="true" class="size-4 shrink-0" />
		<span>{m.network_offline()}</span>
	</div>
{/if}

{@render children()}
