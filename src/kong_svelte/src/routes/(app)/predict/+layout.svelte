<script lang="ts">
  import { goto } from "$app/navigation";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";

  let { children } = $props<{ children: any }>();
</script>

<!-- Regular prediction markets content -->
<div class="container mx-auto !max-w-[1600px] text-kong-text-primary my-4">
  {@render children?.()}
</div>
