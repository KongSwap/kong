<script lang="ts">
  export let variant: "default" | "stats" = "default";
  export let textClass: "text-left" | "text-right" | "text-center" | null = "text-left";
  export let column: string;
  export let label: string;
  export let sortColumn: string;
  export let sortDirection: "asc" | "desc";
  export let onSort: (column: string) => void;

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

<th class="p-2 cursor-pointer {className} {textClass}" on:click={() => onSort(column)}>
  {label}
  <span>
    {#if sortColumn === column}
      {sortDirection === "asc" ? "↑" : "↓"}
    {:else}
      &nbsp;
    {/if}
  </span>
</th>