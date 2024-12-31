<script lang="ts">
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { ChevronDown } from "lucide-svelte";
  import { createEventDispatcher } from "svelte";
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";

  export let pool;
  export let expanded;
  export let onClick;

  const dispatch = createEventDispatcher();

  function handleClick() {
    dispatch('toggle', pool);
  }
</script>

<div
  class="pool-card group focus:outline-none"
  class:expanded={expanded}
  on:click={handleClick}
  on:keydown={(e) => e.key === 'Enter' && handleClick()}
  role="button"
  tabindex="0"
>
  <!-- Card Content Here -->
</div>

<style lang="postcss">
  /* Styles similar to UserPoolList.svelte */
</style> 