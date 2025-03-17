<script lang="ts">
  import Swap from "$lib/components/swap/Swap.svelte";
  import { themeStore } from "$lib/stores/themeStore";
</script>

<svelte:head>
  <title>Swap - KongSwap</title>
</svelte:head>

<section class="w-full {$themeStore === 'win98light' ? 'mt-8' : ''}">
  <div class="p-2 md:p-0 w-full flex justify-center">
    <Swap />
  </div>
</section>
