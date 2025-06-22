<script lang="ts">
  import { auth } from "$lib/stores/auth";

  export let variant: "default" | "stats" = "default";
  export let textClass: string = "text-left";
  export let column: string;
  export let label: string;
  export let sortColumn: string | null = null;
  export let sortDirection: "asc" | "desc" | null = null;
  export let requiresAuth: boolean = false;
  export let onsort: (data: { column: string, direction: "asc" | "desc" }) => void;

  function handleSort() {
    let newDirection: "asc" | "desc" = "asc";
    if (sortColumn === column) {
      newDirection = sortDirection === "asc" ? "desc" : "asc";
    }
    onsort({ column, direction: newDirection });
  }

  $: variantClass = variant === "stats" ? "font-alumni text-3xl uppercase" : "";
  $: showHeader = requiresAuth ? $auth.isConnected : true;
</script>

{#if showHeader}
  <th 
    class="p-2 cursor-pointer {textClass} {variantClass}"
    onclick={handleSort}
  >
    {label}
    <span>
      {#if sortColumn === column}
        {sortDirection === "asc" ? "↑" : "↓"}
      {:else}
        &nbsp;
      {/if}
    </span>
  </th>
{/if}
