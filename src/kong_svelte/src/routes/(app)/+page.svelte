<script lang="ts">
import Swap from "$lib/components/swap/Swap.svelte";
  import { themeStore } from "$lib/stores/themeStore";
</script>


<section class="w-full flex flex-col p-2 md:p-0 justify-center transition-all duration-200 {$themeStore === 'microswap' ? 'mt-12' : ''}">
  <Swap />
</section>
