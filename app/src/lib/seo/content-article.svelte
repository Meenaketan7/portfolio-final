<script lang="ts">
	import type { PublishedRecord } from '#lib/hooks/api/content/types.js';

	let { record }: { record: PublishedRecord } = $props();
</script>

<article class="mx-auto w-full max-w-3xl px-6 py-16">
	<header class="mb-10 space-y-4">
		<h1 class="text-4xl font-semibold tracking-tight">{record.title}</h1>
		<p class="text-lg text-muted-foreground">{record.summary}</p>
		<time datetime={record.publishedAt}>{record.publishedAt.slice(0, 10)}</time>
		{#if record.author}<p>{record.author.name}</p>{/if}
		{#if record.image}
			<img
				src={record.image.url}
				alt={record.image.alt}
				loading="eager"
				fetchpriority="high"
				class="aspect-video w-full rounded-lg object-contain" />
		{/if}
	</header>
	<div class="space-y-6 leading-7">
		{#each record.bodyBlocks as block}
			{#if block.type === 'heading'}
				{#if block.level === 2}
					<h2 class="text-2xl font-semibold">{block.text}</h2>
				{:else}
					<h3 class="text-xl font-semibold">{block.text}</h3>
				{/if}
			{:else if block.type === 'paragraph'}
				<p>{block.text}</p>
			{:else}
				<ul class="list-disc space-y-2 pl-6">
					{#each block.items as item}<li>{item}</li>{/each}
				</ul>
			{/if}
		{/each}
	</div>
</article>
