<script lang="ts">
  import Swap from "$lib/components/swap/Swap.svelte";
  import { themeStore } from "$lib/stores/themeStore";
  
  // Get the current theme value
  let currentTheme = $derived($themeStore.current || 'base');
</script>

<svelte:head>
  <title>Swap - KongSwap</title>
</svelte:head>

<section class="w-full p-2 md:p-0 flex justify-center {currentTheme === 'win98light' ? 'mt-8' : ''}">
  <Swap />
</section>
