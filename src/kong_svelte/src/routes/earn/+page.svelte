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

<section class="flex justify-center w-full">
  <div class="z-10 flex justify-center w-full max-w-[1400px] mx-auto">
    <div class="flex flex-col w-full gap-3">
      <!-- Section Navigation -->
      <div class="section-selector">
        <div class="button-container">
          <Button
            variant="green"
            size="medium"
            state={$activeSection === "pools" ? "selected" : "default"}
            onClick={() => activeSection.set("pools")}
            width="100%"
          >
            Pools
          </Button>
        </div>
        <div class="button-container relative">
          <Button
            variant="green"
            size="medium"
            state={$activeSection === "staking" ? "selected" : "default"}
            onClick={() => activeSection.set("staking")}
            width="100%"
            disabled={true}
          >
            Staking
          </Button>
          <div class="soon-badge">Soon</div>
        </div>
        <div class="button-container relative">
          <Button
            variant="green"
            size="medium"
            state={$activeSection === "lending" ? "selected" : "default"}
            onClick={() => activeSection.set("lending")}
            width="100%"
            disabled={true}
          >
            Lending
          </Button>
          <div class="soon-badge">Soon</div>
        </div>
      </div>

      {#if $activeSection === "pools"}
        <Panel variant="green" type="main" className="glass-panel">
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
        <Panel variant="green" type="main" className="glass-panel">
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
        <Panel variant="green" type="main" className="glass-panel">
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
</section>

<style lang="postcss">
  .section-selector {
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
    position: relative;
    z-index: 10;
    width: 100%;
  }

  .button-container {
    flex: 1;
    min-width: 0;
  }

  .soon-badge {
    position: absolute;
    top: -8px;
    right: -8px;
    background: #ffd700;
    color: black;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    border: 2px solid black;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    z-index: 20;
  }

  .relative {
    position: relative;
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

  @media (max-width: 640px) {
    section {
      padding: 0.25rem 0.5rem;
    }
  }
</style>
