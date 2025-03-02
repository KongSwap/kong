<script lang="ts">
  import { Loader2 } from "lucide-svelte";
  
  export let text = "Loading...";
  export let size = 20;
  export let fullHeight = false;
</script>

<div class={`flex flex-col items-center justify-center gap-2 ${fullHeight ? 'h-full min-h-full' : 'py-6'}`}>
  <Loader2 class="animate-spin" size={size} />
  <p class="text-kong-text-secondary text-sm">{text}</p>
</div>
