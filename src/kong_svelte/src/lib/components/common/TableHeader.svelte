<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let variant: "default" | "stats" = "default";
  export let textClass: string = "text-left";
  export let column: string;
  export let label: string;
  export let sortColumn: string | null = null;
  export let sortDirection: "asc" | "desc" | null = null;

  const dispatch = createEventDispatcher();

  function handleSort() {
    let newDirection: "asc" | "desc" = "asc";
    if (sortColumn === column) {
      newDirection = sortDirection === "asc" ? "desc" : "asc";
    }
    dispatch('sort', { column, direction: newDirection });
  }

  function getVariantClass() {
    switch (variant) {
      case "stats":
        return "font-alumni text-3xl uppercase";
      default:
        return "";
    }
  }

  $: className = getVariantClass();
</script>

<th class="p-2 cursor-pointer {className} {textClass}" on:click={handleSort}>
  {label}
  <span>
    {#if sortColumn === column}
      {sortDirection === "asc" ? "↑" : "↓"}
    {:else}
      &nbsp;
    {/if}
  </span>
</th>