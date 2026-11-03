<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import LanguagesIcon from '@lucide/svelte/icons/languages';
	import { m } from '$lib/paraglide/messages.js';
	import { getLocale, isLocale, locales, setLocale, type Locale } from '$lib/paraglide/runtime.js';
	import { cn } from '$lib/utils';

	const languageNames: Record<Locale, string> = {
		en: 'English',
		es: 'Español',
		'pt-br': 'Português (Brasil)',
		de: 'Deutsch',
		fr: 'Français',
		ja: '日本語'
	};

	let { class: className }: { class?: string } = $props();

	function changeLanguage(event: Event) {
		const locale = (event.currentTarget as HTMLSelectElement).value;

		if (isLocale(locale) && locale !== getLocale()) {
			setLocale(locale);
		}
	}
</script>

<label class={cn('relative inline-flex items-center', className)}>
	<span class="sr-only">{m.language_selector_label()}</span>
	<LanguagesIcon
		aria-hidden="true"
		class="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
	<select
		value={getLocale()}
		onchange={changeLanguage}
		class="h-9 min-w-44 cursor-pointer appearance-none rounded-md border border-input bg-background pr-9 pl-9 text-sm font-medium shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30">
		{#each locales as locale (locale)}
			<option value={locale} lang={locale}>{languageNames[locale]}</option>
		{/each}
	</select>
	<ChevronDownIcon
		aria-hidden="true"
		class="pointer-events-none absolute right-3 size-4 text-muted-foreground" />
</label>
