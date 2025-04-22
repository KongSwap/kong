<script lang="ts">
    import { goto } from "$app/navigation";
    import ButtonV2 from "$lib/components/common/ButtonV2.svelte";

  
  let { children } = $props<{ children: any }>();
</script>

<!-- Regular prediction markets content -->
<div class="container mx-auto max-w-[1300px] text-kong-text-primary my-4">
  {@render children?.()}
</div>

<div class="container mx-auto max-w-[1300px] text-kong-text-primary my-4 flex justify-center mt-10">
  <ButtonV2 variant="transparent" size="lg" className="!text-kong-text-secondary" on:click={() => {
    goto("/predict/tos");
  }}>
    Terms of Service
  </ButtonV2>
</div>