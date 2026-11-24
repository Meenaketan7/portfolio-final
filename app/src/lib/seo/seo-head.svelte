<script lang="ts">
	import { HREFLANG, imageUrl, jsonLdScript, localPageUrl } from './urls.js';
	import type { SeoData } from './types.js';

	let {
		seo,
		siteOrigin,
		pathname
	}: { seo?: SeoData; siteOrigin?: string | null; pathname: string } = $props();
	// Title and description render whenever they exist; indexing also needs both, plus a known origin
	let title = $derived(typeof seo?.title === 'string' ? seo.title.trim() : '');
	let description = $derived(typeof seo?.description === 'string' ? seo.description.trim() : '');
	let canonical = $derived(siteOrigin ? localPageUrl(siteOrigin, pathname) : null);
	let indexable = $derived(Boolean(title && description && canonical && !seo?.noindex));
	let socialImage = $derived(
		seo?.image?.url && siteOrigin ? imageUrl(siteOrigin, seo.image.url) : null
	);
	let alternates = $derived(
		indexable && seo?.alternates && siteOrigin
			? Object.entries(seo.alternates)
					.map(([locale, path]) => ({
						locale: HREFLANG[locale as keyof typeof HREFLANG],
						url: path ? localPageUrl(siteOrigin, path) : null
					}))
					.filter((entry): entry is { locale: string; url: string } =>
						Boolean(entry.locale && entry.url)
					)
			: []
	);
	let jsonLd = $derived(indexable && seo?.structuredData ? jsonLdScript(seo.structuredData) : null);
</script>

<svelte:head>
	{#if title}
		<title>{title}</title>
	{/if}
	{#if description}
		<meta name="description" content={description} />
	{/if}
	{#if !indexable}
		<meta name="robots" content="noindex" />
	{:else if canonical}
		<link rel="canonical" href={canonical} />
		<meta property="og:title" content={title} />
		<meta property="og:description" content={description} />
		<meta property="og:type" content={seo?.type ?? 'website'} />
		<meta property="og:url" content={canonical} />
		<meta name="twitter:card" content={socialImage ? 'summary_large_image' : 'summary'} />
		<meta name="twitter:title" content={title} />
		<meta name="twitter:description" content={description} />
		{#if socialImage}
			<meta property="og:image" content={socialImage} />
			<meta name="twitter:image" content={socialImage} />
			{#if seo?.image?.alt}
				<meta property="og:image:alt" content={seo.image.alt} />
				<meta name="twitter:image:alt" content={seo.image.alt} />
			{/if}
		{/if}
		{#each alternates as alternate (alternate.locale)}
			<link rel="alternate" hreflang={alternate.locale} href={alternate.url} />
		{/each}
		{#if alternates.some((alternate) => alternate.locale === 'en')}
			<link
				rel="alternate"
				hreflang="x-default"
				href={alternates.find((alternate) => alternate.locale === 'en')?.url} />
		{/if}
		{#if jsonLd}
			{@html jsonLd}
		{/if}
	{/if}
</svelte:head>
