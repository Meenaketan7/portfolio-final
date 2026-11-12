<script lang="ts">
	import { HREFLANG, imageUrl, jsonLdScript, localPageUrl } from './urls.js';
	import type { SeoData } from './types.js';

	let {
		seo,
		siteOrigin,
		pathname
	}: { seo?: SeoData; siteOrigin?: string | null; pathname: string } = $props();
	let completeSeo = $derived(
		typeof seo?.title === 'string' &&
			typeof seo.description === 'string' &&
			seo.title.trim() &&
			seo.description.trim()
			? {
					title: seo.title.trim(),
					description: seo.description.trim(),
					noindex: seo.noindex,
					type: seo.type ?? 'website',
					image: seo.image,
					alternates: seo.alternates,
					structuredData: seo.structuredData
				}
			: null
	);
	let canonical = $derived(siteOrigin ? localPageUrl(siteOrigin, pathname) : null);
	let indexable = $derived(Boolean(completeSeo && !completeSeo.noindex && canonical));
	let socialImage = $derived(
		completeSeo?.image?.url && siteOrigin ? imageUrl(siteOrigin, completeSeo.image.url) : null
	);
	let alternates = $derived(
		indexable && completeSeo?.alternates && siteOrigin
			? Object.entries(completeSeo.alternates)
					.map(([locale, path]) => ({
						locale: HREFLANG[locale as keyof typeof HREFLANG],
						url: path ? localPageUrl(siteOrigin, path) : null
					}))
					.filter((entry): entry is { locale: string; url: string } =>
						Boolean(entry.locale && entry.url)
					)
			: []
	);
	let jsonLd = $derived(
		indexable && completeSeo?.structuredData ? jsonLdScript(completeSeo.structuredData) : null
	);
</script>

<svelte:head>
	{#if completeSeo}
		<title>{completeSeo.title}</title>
		<meta name="description" content={completeSeo.description} />
	{/if}
	{#if !indexable}
		<meta name="robots" content="noindex" />
	{:else if completeSeo && canonical}
		<link rel="canonical" href={canonical} />
		<meta property="og:title" content={completeSeo.title} />
		<meta property="og:description" content={completeSeo.description} />
		<meta property="og:type" content={completeSeo.type} />
		<meta property="og:url" content={canonical} />
		<meta name="twitter:card" content={socialImage ? 'summary_large_image' : 'summary'} />
		<meta name="twitter:title" content={completeSeo.title} />
		<meta name="twitter:description" content={completeSeo.description} />
		{#if socialImage}
			<meta property="og:image" content={socialImage} />
			<meta name="twitter:image" content={socialImage} />
			{#if completeSeo.image?.alt}
				<meta property="og:image:alt" content={completeSeo.image.alt} />
				<meta name="twitter:image:alt" content={completeSeo.image.alt} />
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
