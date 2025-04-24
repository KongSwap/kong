<script lang="ts">
  import { fade } from 'svelte/transition'
  import type { Snippet } from 'svelte'
  import MetaTags from "$lib/components/common/MetaTags.svelte";
  import type { LayoutData } from "./$types";

  let { children, data }: { children: Snippet, data: LayoutData } = $props()
</script>

<MetaTags
  title={data.metadata.title}
  description={data.metadata.description}
  image={data.metadata.image}
  url={data.metadata.url}
/>

<main class="flex flex-col items-center w-full flex-grow">
  <div class="w-full h-full" transition:fade>
    {@render children?.()}
  </div>
</main>