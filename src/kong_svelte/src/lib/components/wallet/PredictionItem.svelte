<script lang="ts">
  import { ArrowUpRight } from "lucide-svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";

  export let bet: any;
  export let onClick: () => void;

  // Calculate potential win for a prediction
  function calculatePotentialWin(): number {
    const totalPool = Number(bet.market.total_pool);
    const outcomePool = Number(bet.market.outcome_pools[Number(bet.outcome_index)]);
    const betAmount = Number(bet.bet_amount);

    if (totalPool > 0 && outcomePool > 0) {
      // Calculate potential win based on current pool ratio
      const ratio = totalPool / outcomePool;
      return betAmount * ratio;
    }
    return 0;
  }

  // Get outcome status for a prediction
  function getOutcomeStatus(): { text: string; color: string } {
    if (!bet.market.status || !("Closed" in bet.market.status)) {
      return { text: "Pending", color: "text-yellow-400" };
    }

    const winningOutcomes = bet.market.status.Closed;
    const isWinner = winningOutcomes.includes(bet.outcome_index);

    return isWinner
      ? { text: "Won", color: "text-kong-success" }
      : { text: "Lost", color: "text-kong-error" };
  }

  const status = getOutcomeStatus();
  const isPending = status.text === "Pending";
</script>

<div
  class="p-4 border-b border-kong-bg-primary hover:bg-kong-bg-primary/10 transition-colors cursor-pointer"
  onclick={onClick}
>
  <div class="flex flex-col gap-1">
    <div class="flex items-start justify-between">
      <div class="text-sm font-medium line-clamp-2 flex-1 flex items-start gap-1">
        <span>{bet.market.question}</span>
        <ArrowUpRight class="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-kong-text-secondary" />
      </div>
      <div class="text-sm font-medium text-right ml-2">{formatBalance(bet.bet_amount, 8, 2)} KONG</div>
    </div>
    
    <div class="flex items-center justify-between text-xs mt-1">
      <div class="px-2 py-0.5 rounded-full bg-kong-bg-primary inline-block">
        {bet.outcome_text}
      </div>
      <div class="{status.color} font-medium">{status.text}</div>
    </div>
    
    <div class="flex items-center justify-between text-xs mt-1">
      <div class="text-kong-text-secondary">
        {isPending ? "Potential Win" : "Winnings"}
      </div>
      
      {#if isPending}
        <div class="text-kong-success">{formatBalance(calculatePotentialWin(), 8, 2)} KONG</div>
      {:else}
        {#if bet.winnings && bet.winnings.length > 0}
          <div class="text-kong-success">{formatBalance(bet.winnings[0], 8, 2)} KONG</div>
        {:else}
          <div class="text-kong-text-secondary">-</div>
        {/if}
      {/if}
    </div>
  </div>
</div> 