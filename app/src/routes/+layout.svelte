<script lang="ts">
	import { page } from '$app/state';
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
		<LanguageSwitcher pathname={page.url.pathname} alternates={page.data.seo?.alternates} />
		<ThemeSwitcher />
		{@render children()}
	</NetworkGate>
</AppProvider>
