<script lang="ts">
  import { t } from "$lib/services/translations";
  import { writable, derived } from "svelte/store";
  import { poolsList, poolsLoading, poolsError } from "$lib/services/pools/poolStore";
  import { formattedTokens } from "$lib/services/tokens/tokenStore";
  import Button from "$lib/components/common/Button.svelte";
  import Panel from "$lib/components/common/Panel.svelte";
  import PoolsTable from "$lib/components/liquidity/pools/PoolsTable.svelte";

  // Navigation state
  const activeSection = writable("pools");
  const activeTab = writable("all_pools");
  
  // Sort state (required by PoolsTable)
  const sortColumn = writable("rolling_24h_volume");
  const sortDirection = writable<"asc" | "desc">("desc");

  // Instead of creating our own derived store, use the existing formattedTokens
  const tokenMap = derived(formattedTokens, ($tokens) => {
    const map = new Map();
    if ($tokens) {
      $tokens.forEach((token) => {
        map.set(token.canister_id, token);
      });
    }
    return map;
  });
</script>

<div class="pools-container">
  <div class="pools-content">
    <!-- Section Navigation -->
    <div class="section-selector">
      <Button
        variant="green"
        size="medium"
        state={$activeSection === "pools" ? "selected" : "default"}
        onClick={() => activeSection.set("pools")}
        width="33%"
      >
        Pools
      </Button>
      <Button
        variant="green"
        size="medium"
        state={$activeSection === "staking" ? "selected" : "default"}
        onClick={() => activeSection.set("staking")}
        width="33%"
      >
        Staking
      </Button>
      <Button
        variant="green"
        size="medium"
        state={$activeSection === "lending" ? "selected" : "default"}
        onClick={() => activeSection.set("lending")}
        width="33%"
      >
        Lending
      </Button>
    </div>

    {#if $activeSection === "pools"}
      <Panel variant="green" width="100%">
        <PoolsTable
          pools={$poolsList}
          loading={$poolsLoading}
          error={$poolsError}
          tokenMap={$tokenMap}
          sortColumn={$sortColumn}
          sortDirection={$sortDirection}
        />
      </Panel>
    {:else if $activeSection === "staking"}
      <Panel variant="green" width="100%">
        <div class="coming-soon-container">
          <h2 class="coming-soon-title">Stake & Earn</h2>
          <div class="coming-soon-badge">Coming Soon</div>
          <div class="feature-list">
            <div class="feature-item">
              <p>Lock your tokens, earn rewards. Simple as that.</p>
              <p class="highlight">Up to 25% APY</p>
            </div>
          </div>
        </div>
      </Panel>
    {:else if $activeSection === "lending"}
      <Panel variant="green" width="100%">
        <div class="coming-soon-container">
          <h2 class="coming-soon-title">Borrow & Lend</h2>
          <div class="coming-soon-badge">Coming Soon</div>
          <div class="feature-list">
            <div class="feature-item">
              <p>Lend your crypto, earn interest. Borrow against your assets.</p>
              <p class="highlight">Low fees. No BS.</p>
            </div>
          </div>
        </div>
      </Panel>
    {/if}
  </div>
</div>

<style>
  .pools-container {
    display: flex;
    justify-content: center;
    width: 100%;
  }

  .pools-content {
    width: 100%;
  }

  .section-selector {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
    position: relative;
    z-index: 10;
  }

  @media (max-width: 768px) {
    .pools-container {
      padding: 12px;
    }
  }

  .coming-soon-container {
    padding: 48px 24px;
    text-align: center;
    color: white;
  }

  .coming-soon-title {
    font-size: 2.5rem;
    font-weight: bold;
    margin-bottom: 16px;
    color: white;
  }

  .coming-soon-badge {
    display: inline-block;
    background: rgba(255, 255, 255, 0.1);
    padding: 8px 16px;
    border-radius: 20px;
    font-weight: 600;
    margin-bottom: 24px;
  }

  .feature-list {
    margin-top: 24px;
  }

  .feature-item {
    background: rgba(255, 255, 255, 0.05);
    padding: 24px;
    border-radius: 12px;
    font-size: 1.2rem;
  }

  .highlight {
    color: #ffd700;
    font-size: 1.5rem;
    font-weight: bold;
    margin-top: 16px;
  }
</style>
