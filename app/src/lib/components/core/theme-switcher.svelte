<script lang="ts">
	import MonitorIcon from '@lucide/svelte/icons/monitor';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SunIcon from '@lucide/svelte/icons/sun';
	import { setMode, userPrefersMode } from 'mode-watcher';
	import { m } from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';

	let { class: className }: { class?: string } = $props();
</script>

<div
	role="group"
	aria-label={m.theme_selector_label()}
	class={cn(
		'inline-flex items-center gap-0.5 rounded-md border border-input bg-background p-0.5 shadow-xs dark:bg-input/30',
		className
	)}>
	<Button
		variant={userPrefersMode.current === 'light' ? 'secondary' : 'ghost'}
		size="icon-sm"
		class="shadow-none"
		aria-label={m.theme_light()}
		aria-pressed={userPrefersMode.current === 'light'}
		title={m.theme_light()}
		onclick={() => setMode('light')}>
		<SunIcon aria-hidden="true" />
	</Button>
	<Button
		variant={userPrefersMode.current === 'dark' ? 'secondary' : 'ghost'}
		size="icon-sm"
		class="shadow-none"
		aria-label={m.theme_dark()}
		aria-pressed={userPrefersMode.current === 'dark'}
		title={m.theme_dark()}
		onclick={() => setMode('dark')}>
		<MoonIcon aria-hidden="true" />
	</Button>
	<Button
		variant={userPrefersMode.current === 'system' ? 'secondary' : 'ghost'}
		size="icon-sm"
		class="shadow-none"
		aria-label={m.theme_system()}
		aria-pressed={userPrefersMode.current === 'system'}
		title={m.theme_system()}
		onclick={() => setMode('system')}>
		<MonitorIcon aria-hidden="true" />
	</Button>
</div>
