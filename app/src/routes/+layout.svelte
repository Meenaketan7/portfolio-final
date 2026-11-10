<script lang="ts">
	import { page } from '$app/state';
	import { locales, localizeHref } from '#lib/paraglide/runtime.js';
	import '../themes/global.css';
	import favicon from '#lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';
	import { Toaster } from '#lib/components/ui/sonner/index.js';
	import { LanguageSwitcher, ThemeSwitcher } from '#lib';
	import { GlobalProgress, NetworkGate } from '#lib/components/core/system/index.js';
	import AppProvider from './app-provider.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<AppProvider>
	<NetworkGate>
		<GlobalProgress />
		<ModeWatcher />
		<Toaster />
		<LanguageSwitcher />
		<ThemeSwitcher />
		{@render children()}
	</NetworkGate>
</AppProvider>

<div style="display:none">
	{#each locales as locale (locale)}
		<a href={localizeHref(page.url.pathname, { locale })} data-sveltekit-reload>{locale}</a>
	{/each}
</div>
