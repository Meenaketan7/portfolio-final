<script lang="ts">
	import { page } from '$app/state';
	import { SeoHead } from '#lib/seo/index.js';

	let { children } = $props();
</script>

<SeoHead seo={page.data.seo} siteOrigin={page.data.siteOrigin} pathname={page.url.pathname} />
{@render children()}
