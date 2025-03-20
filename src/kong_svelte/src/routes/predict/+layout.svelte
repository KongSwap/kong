<script lang="ts">
    import { goto } from "$app/navigation";

  let { children } = $props<{ children: any }>();

  $effect(() => {
    goto("/swap");
  });
</script>

<svelte:head>
  <title>Prediction Markets - KongSwap</title>
</svelte:head>

<!-- Regular prediction markets content -->
<div class="container mx-auto max-w-[1300px] text-kong-text-primary my-4">
  {@render children?.()}
</div>
