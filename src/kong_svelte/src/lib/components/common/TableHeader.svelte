<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { t } from "$lib/locales/translations";
  import { walletStore } from "$lib/stores/walletStore";

  export let variant: "default" | "stats" = "default";
  export let textClass: string = "text-left";
  export let column: string;
  export let label: string;
  export let sortColumn: string | null = null;
  export let sortDirection: "asc" | "desc" | null = null;
  export let requiresAuth: boolean = false;
  const dispatch = createEventDispatcher();

  function handleSort() {
    let newDirection: "asc" | "desc" = "asc";
    if (sortColumn === column) {
      newDirection = sortDirection === "asc" ? "desc" : "asc";
    }
    dispatch("sort", { column, direction: newDirection });
  }

  function getVariantClass() {
    switch (variant) {
      case "stats":
        return "font-alumni text-3xl uppercase";
      default:
        return "";
    }
  }

  $: showHeader = requiresAuth ? $walletStore.isConnected : true;
  $: className = getVariantClass();
</script>

{#if showHeader}
  <th class="p-2 cursor-pointer {className} {textClass}" on:click={handleSort}>
    {$t(label)}
    <span>
      {#if sortColumn === column}
        {sortDirection === "asc" ? "↑" : "↓"}
      {:else}
        &nbsp;
      {/if}
    </span>
  </th>
{/if}
