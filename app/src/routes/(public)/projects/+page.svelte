<script lang="ts">
	import ContentList from '#lib/seo/content-list.svelte';

	let { data } = $props();
</script>

<ContentList
	kind="project"
	title={data.seo.title}
	items={data.items}
	nextCursor={data.nextCursor} />
