<script lang="ts">
	import ContentArticle from '#lib/seo/content-article.svelte';

	let { data } = $props();
</script>

<ContentArticle record={data.record} />
