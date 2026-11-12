<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';

	type Props = {
		status: number;
		title: string;
		description?: string;
		homeHref: string;
		homeLabel: string;
		retryLabel?: string;
	};

	let { status, title, description, homeHref, homeLabel, retryLabel }: Props = $props();
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<main class="relative isolate min-h-svh overflow-hidden bg-background text-foreground">
	<div
		aria-hidden="true"
		class="pointer-events-none absolute inset-0 opacity-30 dark:opacity-20"
		style="background-image: linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px); background-size: 4.75rem 4.75rem; mask-image: linear-gradient(to bottom, transparent, black 15%, transparent 85%);">
	</div>

	<div class="relative mx-auto flex min-h-svh w-full max-w-6xl flex-col px-6 py-8 sm:px-10">
		<div class="flex items-center justify-between border-b border-border pb-6">
			<div class="flex gap-1.5" aria-hidden="true">
				<span class="size-2 rounded-full bg-foreground"></span>
				<span class="size-2 rounded-full bg-muted-foreground/50"></span>
				<span class="size-2 rounded-full bg-muted-foreground/25"></span>
			</div>
			<span class="font-mono text-xs tracking-[0.16em] text-muted-foreground">HTTP {status}</span>
		</div>

		<section
			class="grid flex-1 items-center gap-14 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,21rem)] lg:gap-20">
			<div class="relative z-10 max-w-2xl">
				<div
					class={`mb-8 h-1 w-12 rounded-full ${status >= 500 ? 'bg-destructive' : 'bg-foreground'}`}
					aria-hidden="true">
				</div>
				<h1
					class="max-w-[13ch] text-5xl leading-[1.05] font-semibold tracking-[-0.06em] text-balance sm:text-6xl lg:text-7xl">
					{title}
				</h1>
				{#if description}
					<p class="mt-7 max-w-lg text-base leading-7 text-pretty text-muted-foreground sm:text-lg">
						{description}
					</p>
				{/if}
				<div class="mt-10 flex flex-wrap gap-3">
					<Button href={homeHref} size="lg">{homeLabel}</Button>
					{#if retryLabel}
						<Button variant="outline" size="lg" onclick={() => window.location.reload()}>
							{retryLabel}
						</Button>
					{/if}
				</div>
			</div>

			<div
				aria-hidden="true"
				class="relative mx-auto grid aspect-square w-full max-w-[21rem] place-items-center rounded-full border border-border bg-card/70">
				<div class="absolute inset-6 rounded-full border border-dashed border-border"></div>
				<div class="absolute inset-16 rounded-full border border-border/70"></div>
				<span
					class={`absolute top-1/2 -left-1.5 size-3 -translate-y-1/2 rounded-full ${status >= 500 ? 'bg-destructive' : 'bg-foreground'}`}
				></span>
				<span class="relative font-mono text-[clamp(4.5rem,12vw,7.5rem)] tracking-[-0.1em]">
					{status}
				</span>
			</div>
		</section>

		<div class="h-px w-full bg-border" aria-hidden="true"></div>
	</div>
</main>
