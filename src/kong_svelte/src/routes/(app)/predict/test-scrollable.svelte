<script lang="ts">
  import ScrollableContainer from "$lib/components/common/ScrollableContainer.svelte";
</script>

<div class="p-4">
  <h2 class="text-xl mb-4">Testing ScrollableContainer</h2>
  
  <div class="border border-kong-border rounded-lg h-[200px]">
    <ScrollableContainer>
      <div class="p-4">
        {#each Array(20) as _, i}
          <div class="p-2 mb-2 bg-kong-bg-tertiary rounded">
            Item {i + 1}
          </div>
        {/each}
      </div>
    </ScrollableContainer>
  </div>
</div>