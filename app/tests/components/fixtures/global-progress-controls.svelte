<script lang="ts">
	import { getUiContext } from '#lib/hooks/store/ui/index.js';

	const ui = getUiContext();
	let finishTask: (() => void) | undefined;
</script>

<button onclick={() => (finishTask = ui.beginTask())}>Start UI task</button>
<button onclick={() => finishTask?.()}>Finish UI task</button>
