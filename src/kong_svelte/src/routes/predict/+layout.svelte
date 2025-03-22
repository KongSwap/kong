<script lang="ts">  
  let { children } = $props<{ children: any }>();
</script>

<!-- Regular prediction markets content -->
<div class="container mx-auto max-w-[1300px] text-kong-text-primary my-4">
  {@render children?.()}
</div>
