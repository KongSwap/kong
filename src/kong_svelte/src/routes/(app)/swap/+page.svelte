<script lang="ts">
  import Swap from "$lib/components/swap/Swap.svelte";
  import { themeStore } from "$lib/stores/themeStore";
</script>

<svelte:head>
  <title>Swap - KongSwap</title>
</svelte:head>

<section class="w-full p-2 md:p-0 flex justify-center {$themeStore === 'microswap' ? 'mt-8' : ''}">
  <Swap />
</section>
