<script lang="ts">
	import { navigating } from '$app/state';
	import { useIsFetching, useIsMutating } from '@tanstack/svelte-query';
	import { getUiContext } from '#lib/hooks/store/ui/index.js';
	import { m } from '#lib/paraglide/messages.js';

	const initialQueries = useIsFetching({
		predicate: (query) => query.isActive() && query.state.data === undefined
	});
	const mutations = useIsMutating({ predicate: (mutation) => !mutation.state.isPaused });
	const { pendingTasks } = getUiContext();
	let visible = $state(false);
	let busy = $derived(
		Boolean(navigating.to) ||
			initialQueries.current > 0 ||
			mutations.current > 0 ||
			$pendingTasks > 0
	);

	$effect(() => {
		if (!busy) {
			visible = false;
			return;
		}

		const timer = window.setTimeout(() => {
			visible = true;
		}, 150);
		return () => window.clearTimeout(timer);
	});
</script>

{#if visible}
	<div
		role="progressbar"
		aria-label={m.loading()}
		class="app-progress fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-primary/20">
		<div class="loading-bar h-full w-1/3 bg-primary"></div>
	</div>
{/if}

<style>
	.loading-bar {
		animation: travel 1.2s ease-in-out infinite;
	}

	@keyframes travel {
		from {
			transform: translateX(-100%);
		}

		to {
			transform: translateX(300%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.loading-bar {
			animation: none;
			width: 100%;
		}
	}
</style>
