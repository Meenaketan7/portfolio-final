<script lang="ts">
	import { page } from '$app/state';
	import { extractLocaleFromUrl } from '#lib/paraglide/runtime.js';
	import { contentPath } from '#lib/hooks/api/content/content-path.js';
	import { m } from '#lib/paraglide/messages.js';
	import type { ContentKind, PublishedSummary } from '#lib/hooks/api/content/types.js';

	let {
		kind,
		title,
		items,
		nextCursor
	}: {
		kind: Exclude<ContentKind, 'page'>;
		title: string;
		items: PublishedSummary[];
		nextCursor: string | null;
	} = $props();
	let locale = $derived(extractLocaleFromUrl(new URL(page.url.href)) ?? 'en');
</script>

<main class="mx-auto w-full max-w-4xl px-6 py-16">
	<h1 class="mb-8 text-4xl font-semibold tracking-tight">{title}</h1>
	<ul class="space-y-8">
		{#each items as item (item.id)}
			<li>
				<h2 class="text-2xl font-semibold">
					<a href={contentPath(kind, locale, item.slug)}>{item.title}</a>
				</h2>
				<p class="text-muted-foreground">{item.summary}</p>
			</li>
		{/each}
	</ul>
	{#if nextCursor}
		<a class="mt-10 inline-block underline" href={`?cursor=${encodeURIComponent(nextCursor)}`}
			>{m.content_more({}, { locale })}</a>
	{/if}
</main>
