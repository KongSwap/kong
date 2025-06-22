<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import { GOVERNANCE_CANISTER_IDS } from "$lib/utils/snsUtils";
  import { ExternalLink } from "lucide-svelte";

  const { 
    token, 
    activeTab, 
    onTabChange
  } = $props<{
    token: Kong.Token;
    activeTab: "overview" | "governance";
    onTabChange: (tab: "overview" | "governance") => void;
  }>();
</script>

<Panel variant="transparent" type="main" className="p-4 md:p-6 !bg-kong-bg-secondary">
  <div class="flex flex-col">
    <!-- Navigation Tabs Only -->
    <div>
      <div class="text-xs uppercase text-kong-text-secondary tracking-wider mb-3">View</div>
      <div class="flex items-center gap-3 flex-wrap">
        <button
          role="tab"
          id="overview-tab-info"
          aria-selected={activeTab === "overview"}
          class="px-4 py-2.5 rounded-lg font-medium transition-colors duration-200 {activeTab === 'overview'
            ? 'bg-kong-bg-secondary text-kong-text-primary'
            : 'text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-bg-secondary/30'}"
          onclick={() => onTabChange("overview")}
        >
          Overview
        </button>

        {#if token?.address && GOVERNANCE_CANISTER_IDS[token.address]}
          <button
            role="tab"
            id="governance-tab-info"
            aria-selected={activeTab === "governance"}
            class="px-4 py-2.5 rounded-lg font-medium transition-colors duration-200 {activeTab === 'governance'
              ? 'bg-kong-bg-secondary text-kong-text-primary'
              : 'text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-bg-secondary/30'}"
            onclick={() => onTabChange("governance")}
          >
            Governance
          </button>
        {/if}

        <!-- External Links -->
        {#if token?.address}
          <a
            href={`https://dashboard.internetcomputer.org/canister/${token.address}`}
            target="_blank"
            rel="noopener noreferrer"
            class="px-4 py-2.5 rounded-lg font-medium text-kong-text-secondary hover:text-kong-text-primary hover:bg-kong-bg-secondary/30 transition-colors duration-200 flex items-center gap-1.5"
          >
            IC Dashboard
            <ExternalLink class="w-3.5 h-3.5" />
          </a>
        {/if}
      </div>
    </div>
  </div>
</Panel>

<style scoped>
  /* Consistent text colors */
  .text-kong-text-secondary {
    color: rgba(136, 144, 164, 1);
  }
</style> 