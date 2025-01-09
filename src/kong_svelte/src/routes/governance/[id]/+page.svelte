<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import Panel from "$lib/components/common/Panel.svelte";
  import SNSProposals from '$lib/components/stats/SNSProposals.svelte';
  import { GOVERNANCE_CANISTER_IDS } from "$lib/services/sns/snsService";
  import { kongDB } from "$lib/services/db";
  import TokenImages from "$lib/components/common/TokenImages.svelte";

  let token = $state<FE.Token | undefined>(undefined);

  // Load token data
  $effect(() => {
    const pageId = $page.params.id;
    kongDB.tokens.get(pageId).then((foundToken) => {
      if (foundToken) {
        token = foundToken;
      } else {
        console.warn("Token not found:", pageId);
        token = undefined;
      }
    });
  });
</script>

<div class="p-4 pt-0">
  {#if !token}
    <div class="flex flex-col items-center justify-center min-h-[300px]">
      <div class="text-kong-text-primary/70">Token not found</div>
      <button
        class="mt-4 px-4 py-2 bg-kong-bg-dark rounded-lg hover:bg-kong-bg-dark/80 transition-colors"
        on:click={() => goto("/stats")}
      >
        Return to Stats
      </button>
    </div>
  {:else if !GOVERNANCE_CANISTER_IDS[token.canister_id]}
    <div class="flex flex-col items-center justify-center min-h-[300px]">
      <div class="text-kong-text-primary/70">No governance data available for this token</div>
      <button
        class="mt-4 px-4 py-2 bg-kong-bg-dark rounded-lg hover:bg-kong-bg-dark/80 transition-colors"
        on:click={() => goto(`/stats/${token.canister_id}`)}
      >
        Return to Token Stats
      </button>
    </div>
  {:else}
    <div class="flex flex-col max-w-[1300px] mx-auto gap-6">
      <!-- Token Header -->
      <Panel variant="transparent" type="main">
        <div class="flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <button
                title="Back"
                aria-label="Back"
                on:click={() => goto(`/stats/${token.canister_id}`)}
                class="flex min-h-[40px] md:min-h-[48px] flex-col items-center justify-center gap-2 px-2.5 text-sm bg-kong-bg-secondary hover:bg-kong-bg-secondary/80 text-kong-text-primary/70 rounded-lg transition-colors duration-200 w-fit"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-3.5 w-3.5 md:h-4 md:w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L4.414 9H17a1 1 0 110 2H4.414l5.293 5.293a1 1 0 010 1.414z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>

              <div class="flex items-center gap-3">
                <TokenImages
                  tokens={[token]}
                  size={36}
                  containerClass="md:w-12 md:h-12"
                />
                <div class="flex items-center gap-2">
                  <h1 class="text-lg md:text-2xl font-bold text-kong-text-primary">
                    {token.name} Governance
                  </h1>
                  <div class="text-sm md:text-base text-[#8890a4]">
                    ({token.symbol})
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <!-- Governance Content -->
      <SNSProposals 
        governanceCanisterId={GOVERNANCE_CANISTER_IDS[token.canister_id]} 
      />
    </div>
  {/if}
</div>

<style>
  /* Make back button more square */
  :global(button[title="Back"]) {
    aspect-ratio: 1;
    padding: 0;
    width: 40px;
    height: 40px;
  }

  @media (min-width: 768px) {
    :global(button[title="Back"]) {
      width: 48px;
      height: 48px;
    }
  }
</style> 