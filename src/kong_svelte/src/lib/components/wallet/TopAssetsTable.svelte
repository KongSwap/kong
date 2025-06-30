<script lang="ts">
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import Badge from "$lib/components/common/Badge.svelte";
  import {
    formatBalance,
    formatToNonZeroDecimal,
  } from "$lib/utils/numberFormatUtils";
  import type { Balance } from "$lib/services/wallet";
  import type { Token } from "$lib/types/token";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";

  let {
    balances,
    tokens,
    totalValue,
    limit = 5,
    whaleThreshold = 1,
  } = $props<{
    balances: Record<string, Balance>;
    tokens: Token[];
    totalValue: number;
    limit?: number;
    whaleThreshold?: number;
  }>();

  // Helper functions
  function getSupplyPercentage(
    tokenId: string,
    balance: string | bigint,
  ): number {
    const token = tokens.find((t) => t.address === tokenId);
    if (!token?.metrics?.total_supply) return 0;

    const totalSupply = Number(token.metrics.total_supply);
    if (totalSupply <= 0) return 0;

    const balanceStr =
      typeof balance === "bigint" ? balance.toString() : balance;
    return (Number(balanceStr) / totalSupply) * 100;
  }

  function isWhalePosition(tokenId: string, balance: string | bigint): boolean {
    return getSupplyPercentage(tokenId, balance) >= whaleThreshold;
  }

  function formatSupplyPercentage(percent: number): string {
    return percent.toFixed(2) + "%";
  }

  const whaleTooltipText = `This wallet holds at least ${whaleThreshold}% of the token's total supply, making it a significant holder ("whale").`;

  // Sort and prepare top assets
  let topAssets = $derived(
    Object.entries(balances)
      .filter(([_, balance]) => Number(balance?.in_usd || 0) > 0)
      .sort((a, b) => Number(b[1]?.in_usd || 0) - Number(a[1]?.in_usd || 0))
      .slice(0, limit)
      .map(([canisterId, balance]) => {
        const token = tokens.find((t) => t.address === canisterId);
        return {
          canisterId,
          balance,
          token,
          isWhale: token
            ? isWhalePosition(canisterId, balance?.in_tokens || "0")
            : false,
          whalePercentage: token
            ? getSupplyPercentage(canisterId, balance?.in_tokens || "0")
            : 0,
          portfolioPercentage:
            (Number(balance?.in_usd || 0) / totalValue) * 100,
        };
      }),
  );
</script>

<div class="overflow-x-auto rounded-lg">
  <table class="w-full">
    <thead class="text-sm text-kong-text-secondary border-b border-kong-border">
      <tr>
        <th class="text-left py-3 px-4">Asset</th>
        <th class="text-right py-3 px-4">Balance</th>
        <th class="text-right py-3 px-4">USD Value</th>
        <th class="text-right py-3 px-4">% of Portfolio</th>
      </tr>
    </thead>
    <tbody>
      {#each topAssets as asset}
        {#if asset.token}
          <tr
            class="border-b border-kong-border/50 hover:bg-kong-bg-primary/60 transition-colors cursor-pointer"
            onclick={() =>
              goto(
                `/wallets/${page.params.principalId}/tokens/${asset.token.address}`,
              )}
          >
            <td class="py-4 px-4">
              <div class="flex items-center gap-3">
                <TokenImages tokens={[asset.token]} size={32} />
                <div class="flex flex-col">
                  <div class="flex items-center gap-1">
                    <div class="font-semibold text-kong-text-primary">
                      {asset.token.symbol}
                    </div>
                    {#if asset.isWhale}
                      <Badge
                        variant="blue"
                        icon="🐋"
                        size="xs"
                        tooltip={whaleTooltipText}
                      >
                        {formatSupplyPercentage(asset.whalePercentage)}
                      </Badge>
                    {/if}
                  </div>
                  <div class="text-xs text-kong-text-secondary">
                    {asset.token.name}
                  </div>
                </div>
              </div>
            </td>
            <td class="text-right py-4 px-4 text-kong-text-primary">
              {#if asset.balance?.in_tokens !== undefined}
                <div class="font-medium">
                  {formatBalance(asset.balance.in_tokens, asset.token.decimals)}
                </div>
              {:else}
                <div>-</div>
              {/if}
            </td>
            <td class="text-right py-4 px-4 text-kong-text-primary">
              <div class="font-medium">
                ${formatToNonZeroDecimal(asset.balance?.in_usd || "0")}
              </div>
            </td>
            <td class="text-right py-4 px-4 text-kong-text-primary">
              <div class="font-medium">
                {asset.portfolioPercentage.toFixed(2)}%
              </div>
            </td>
          </tr>
        {/if}
      {/each}
    </tbody>
  </table>
</div>
