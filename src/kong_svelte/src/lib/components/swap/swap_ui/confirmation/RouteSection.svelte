<script lang="ts">
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import TokenDetails from "$lib/components/common/TokenDetails.svelte";
  import { liveTokens } from "$lib/services/tokens/tokenStore";

  export let routingPath: string[] = [];

  $: tokens = routingPath
    ? routingPath
      .map(symbol => $liveTokens.find(t => t.symbol === symbol))
      .filter((t): t is FE.Token => t !== undefined)
    : [];

  let selectedToken: FE.Token | null = null;
</script>

<div class="route-container">
  {#if tokens.length > 0}
    <div class="route-header">Your Swap Route</div>
    <div class="route-line">
      {#each tokens as token, i}
        <div class="token-group">
          <div
            class="token-block"
            on:click={() => selectedToken = token}
            role="button"
            tabindex="0"
          >
            <div class="token-inner">
              <div class="token-icon">
                <TokenImages tokens={[token]} size={32} containerClass="token-image" />
              </div>
              <div class="token-symbol hide-mobile">{token.symbol}</div>
            </div>
          </div>
          {#if i < tokens.length - 1}
            <div class="arrow">→</div>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <div class="no-route">No route available</div>
  {/if}
</div>

{#if selectedToken}
  <TokenDetails
    token={selectedToken}
    on:close={() => selectedToken = null}
  />
{/if}

<style>
  .route-container {
    width: 100%;
    padding: 8px;
    box-sizing: border-box;
  }

  .route-header {
    text-align: center;
    color: rgba(255,255,255,0.9);
    font-size: 16px;
    font-weight: 500;
    margin-bottom: 12px;
  }

  .route-line {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: nowrap;
    gap: 4px;
    overflow-x: auto;
    padding: 4px 2px;
  }

  .token-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .token-block {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 6px 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    width: 80px
  }

  .token-block:hover {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.2);
  }

  .token-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .token-symbol {
    color: #ffffff;
    font-size: 14px;
    font-weight: 500;
  }

  .arrow {
    color: rgba(255,255,255,0.6);
    font-size: 18px;
    padding: 0 2px;
  }

  .no-route {
    color: rgba(255,255,255,0.6);
    text-align: center;
    padding: 12px;
  }

  @media (max-width: 600px) {
    .route-line {
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    
    .route-line::-webkit-scrollbar {
      display: none;
    }

    .token-block {
      padding: 4px 8px;
    }

    .token-inner {
      gap: 4px;
    }

    .token-symbol {
      font-size: 12px;
    }

    .arrow {
      font-size: 16px;
      padding: 0 1px;
    }

    .hide-mobile {
      display: none;
    }

    .token-block {
      padding: 4px;
    }

    .token-inner {
      gap: 0;
    }

    .arrow {
      font-size: 16px;
      padding: 0 2px;
    }
  }
</style>
