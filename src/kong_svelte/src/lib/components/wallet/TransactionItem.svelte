<script lang="ts">
  import {
    ArrowDownRight,
    ArrowUpRight,
    Plus,
    Minus,
    Repeat,
    ArrowRightLeft,
    ExternalLink,
  } from "lucide-svelte";
  import Badge from "$lib/components/common/Badge.svelte";
  import { getTransactionIcon } from "$lib/utils/transactionUtils";

  let { tx, onClick } = $props();
  
  // Get icon component based on type name
  function getIconComponent(iconName: string) {
    switch (iconName) {
      case "ArrowRightLeft": return ArrowRightLeft;
      case "Plus": return Plus;
      case "Minus": return Minus;
      case "ArrowUpRight": return ArrowUpRight;
      case "ArrowDownRight": return ArrowDownRight;
      default: return Repeat;
    }
  }
</script>

<div
  class="px-4 py-3.5 bg-kong-bg-secondary/5 border-b border-kong-border/30 hover:bg-kong-bg-secondary/10 transition-colors cursor-pointer"
  onclick={onClick}
>
  <div class="flex items-center justify-between mb-2">
    <div class="flex items-center justify-between w-full gap-2">
      <div class="flex items-center gap-2">
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center {tx.status ===
          'Success'
            ? 'bg-kong-success/10'
            : 'bg-kong-error/10'} flex-shrink-0"
        >
          <svelte:component
            this={getIconComponent(getTransactionIcon(tx.type))}
            class={tx.status === "Success"
              ? "text-kong-success"
              : "text-kong-error"}
            size={16}
          />
        </div>

        <div class="flex flex-col justify-center">
          <div class="font-medium text-kong-text-primary text-sm leading-tight">
            {tx.type}
          </div>
          <div class="text-xs text-kong-text-secondary mt-1 leading-tight">
            {#if tx.type === "Swap"}
              {tx.details.pay_amount}
              {tx.details.pay_token_symbol} → {tx.details.receive_amount}
              {tx.details.receive_token_symbol}
            {:else if tx.type === "Send"}
              {tx.details.amount} {tx.details.token_symbol}
            {:else}
              {tx.details.amount_0}
              {tx.details.token_0_symbol} + {tx.details.amount_1}
              {tx.details.token_1_symbol}
            {/if}
          </div>
          <div class="text-xs text-kong-text-secondary mt-1 leading-tight">
            {tx.formattedDate}
          </div>
        </div>
      </div>
      <div class="text-right flex flex-col justify-end gap-2">
        <div class="text-right flex flex-col justify-end">
          <div
            class="text-xs font-medium {tx.status === 'Success'
              ? 'text-kong-success'
              : 'text-kong-error'} capitalize leading-tight"
          >
            {tx.status}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Badge
            variant="blue"
            size="xs"
            class="text-[10px] uppercase tracking-wide font-semibold"
          >
            ICP
          </Badge>
          <button
            class="text-kong-text-secondary hover:text-kong-primary transition-colors"
            title="View Details"
          >
            <ExternalLink size={12} />
          </button>
        </div>
      </div>
    </div>
  </div>
</div> 