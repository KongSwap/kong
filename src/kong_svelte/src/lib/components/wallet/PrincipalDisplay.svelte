<script lang="ts">
  import { Check, Copy } from "lucide-svelte";
  import { toastStore } from "$lib/stores/toastStore";

  let {
    principal,
    class: className = "",
    showFullAddress = false,
    fontSize = "text-sm",
    iconSize = 16,
    copyable = true,
  } = $props<{
    principal: string;
    class?: string;
    showFullAddress?: boolean;
    fontSize?: string;
    iconSize?: number;
    copyable?: boolean;
  }>();

  let copied = $state(false);

  function formatAddress(address: string): string {
    if (showFullAddress) return address;
    return `${address.slice(0, 5)}...${address.slice(-3)}`;
  }

  async function copyAddress() {
    if (!copyable) return;

    try {
      await navigator.clipboard.writeText(principal);
      copied = true;
      toastStore.success("Address copied to clipboard");
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (err) {
      toastStore.error("Failed to copy address");
    }
  }
</script>

<div class="flex items-center gap-2 {className}">
  <span class="{fontSize} font-mono text-kong-text-secondary">
    {formatAddress(principal)}
  </span>
  {#if copyable}
    <button
      onclick={copyAddress}
      class="p-1.5 rounded-md hover:bg-kong-bg-secondary/50 transition-colors
             text-kong-text-secondary hover:text-kong-text-primary"
      title="Copy address"
    >
      {#if copied}
        <Check size={iconSize} class="text-kong-success" />
      {:else}
        <Copy size={iconSize} />
      {/if}
    </button>
  {/if}
</div>
