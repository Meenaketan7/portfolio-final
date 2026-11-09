<script lang="ts">
	import { navigating, page } from '$app/state';
	import { onMount } from 'svelte';
	import { locales, localizeHref } from '#lib/paraglide/runtime.js';
	import '../themes/global.css';
	import favicon from '#lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '#lib/components/ui/sonner/index.js';
	import { LanguageSwitcher, ThemeSwitcher } from '#lib';

	let { children } = $props();
	let mounted = $state(false);

	onMount(() => {
		mounted = true;
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{#if !mounted || navigating.to}
	<div
		aria-hidden="true"
		class="app-progress fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-primary/20">
		<div class="loading-bar h-full w-1/3 bg-primary"></div>
	</div>
{/if}
<ModeWatcher />
<Toaster />
<LanguageSwitcher />
<ThemeSwitcher />

{@render children()}

<div style="display:none">
	{#each locales as locale (locale)}
		<a href={localizeHref(page.url.pathname, { locale })} data-sveltekit-reload>{locale}</a>
	{/each}
</div>

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
