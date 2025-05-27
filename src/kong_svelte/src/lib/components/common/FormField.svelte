<script lang="ts">
  import { AlertTriangle, HelpCircle } from "lucide-svelte";
  import { tooltip } from "$lib/actions/tooltip";

  let { id = "", label = "", helpText = "", error = "", children = () => {} } = $props();
</script>

<div class="space-y-2">
  <div class="flex justify-center gap-2 flex-col">
    <div class="flex items-center gap-2">
      <label
        for={id}
        class="block text-xs uppercase font-medium text-kong-text-primary"
        >{label}</label
      >
      {#if helpText}
        <div use:tooltip={{ text: helpText, direction: "right" }}>
          <HelpCircle size={16} class="text-kong-text-secondary cursor-help" />
        </div>
      {/if}
    </div>

    {#if error}
      <p class="text-sm text-kong-error flex items-center gap-2 mt-2">
        <AlertTriangle size={16} />
        {error}
      </p>
    {/if}
  </div>

  {@render children?.()}
</div>
