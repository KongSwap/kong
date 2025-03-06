<script lang="ts">
  import { goto } from "$app/navigation";
  import Panel from "$lib/components/common/Panel.svelte";
  import {
    ArrowLeft,
  } from "lucide-svelte";
  import type {
    MinerType,
    MinerInitArgs,
  } from "$declarations/miner/miner.did.d";
  import { minerParams } from "$lib/stores/minerParams";
  import { onMount } from "svelte";
  import { canisterStore } from "$lib/stores/canisters";
  import { get } from "svelte/store";

  let selectedType: MinerType = { Normal: null };
  let isSubmitting = false;
  let selectedTokenId: string | undefined = undefined;
  let userTokens: Array<{ id: string, name: string, tags: string[] }> = [];

  // Load user's tokens on mount
  onMount(() => {
    const canisters = get(canisterStore);
    userTokens = canisters
      .filter(canister => canister.tags?.includes('token'))
      .map(canister => ({
        id: canister.id,
        name: canister.name || canister.id,
        tags: canister.tags || []
      }));
  });

  // Mining parameters
  let blockReward = 100;
  let halvingBlocks = 100000;
  let blockTimeSeconds = 30;
  let maxSupply = 1000000;

  // Social links
  type SocialLink = {
    platform: string;
    url: string;
  };

  let socialLinks: SocialLink[] = [
    { platform: "Twitter", url: "" },
    { platform: "Discord", url: "" },
    { platform: "Telegram", url: "" },
  ];

  function addSocialLink() {
    socialLinks = [...socialLinks, { platform: "", url: "" }];
  }

  function removeSocialLink(index: number) {
    socialLinks = socialLinks.filter((_, i) => i !== index);
  }

  function calculateCirculationTime() {
    const blocksToMineAll = maxSupply / blockReward;
    const halvings = Math.floor(Math.log2(blocksToMineAll / halvingBlocks));
    let remainingBlocks = blocksToMineAll;
    let currentReward = blockReward;
    let totalTime = 0;

    for (let i = 0; i <= halvings; i++) {
      const blocksInThisPhase = Math.min(remainingBlocks, halvingBlocks);
      totalTime += blocksInThisPhase * blockTimeSeconds;
      remainingBlocks -= blocksInThisPhase;
      currentReward /= 2;
    }

    const days = Math.floor(totalTime / (24 * 60 * 60));
    const years = (days / 365).toFixed(2);
    return { days, years };
  }

  $: circulationTime = calculateCirculationTime();

  const minerTypes: {
    type: MinerType;
    name: string;
    description: string;
    features: string[];
  }[] = [
    {
      type: { Lite: null },
      name: "Lite Miner",
      description: "Perfect for beginners",
      features: [
        "Basic mining capabilities",
        "Single token mining",
        "Standard hash rate",
      ],
    },
    {
      type: { Normal: null },
      name: "Normal Miner",
      description: "Balanced performance",
      features: [
        "Enhanced mining capabilities",
        "Multi-token support",
        "Improved hash rate",
        "Priority support",
      ],
    },
    {
      type: { Premium: null },
      name: "Premium Miner",
      description: "Maximum performance",
      features: [
        "Advanced mining capabilities",
        "Unlimited token support",
        "Maximum hash rate",
        "Priority support",
        "Early access to new features",
      ],
    },
  ];

  async function handleSubmit(type: MinerType) {
    isSubmitting = true;
    try {
      // Store the selected miner type in the minerParams store
      const initArgs = {
        owner: null, // Will be set by the backend
        minerType: type,
        tokenCanisterId: selectedTokenId
      };
      
      // Update the miner parameters store
      minerParams.set(initArgs);
      
      // Navigate to the miner deployment page
      goto("/launch/deploy-miner");
    } catch (error) {
      console.error("Error preparing miner deployment:", error);
    } finally {
      isSubmitting = false;
    }
  }

  function handleCancel() {
    goto("/launch");
  }
</script>

<div class="min-h-screen px-4 py-8 text-kong-text-primary">
  <div class="mx-auto max-w-7xl">
    <div class="mb-8">
      <button
        on:click={handleCancel}
        class="flex items-center gap-2 text-kong-text-primary/60 hover:text-kong-text-primary"
      >
        <ArrowLeft size={20} />
        Back to Launch
      </button>
    </div>

    <div class="mb-8 text-center">
      <h1 class="mb-2 text-2xl font-bold">Choose Your Miner Type</h1>
      <p class="text-kong-text-primary/60">
        Select the type of miner that best suits your needs
      </p>
    </div>

    <!-- Token Selection -->
    <div class="mb-8">
      <Panel>
        <div class="p-6">
          <h2 class="mb-4 text-xl font-semibold">Connect to a Token (Optional)</h2>
          <p class="mb-4 text-kong-text-primary/60">
            You can automatically connect your miner to one of your tokens. This is optional and you can connect to a token later.
          </p>
          
          {#if userTokens.length > 0}
            <div class="mb-4">
              <label for="token-select" class="block mb-2 text-sm font-medium">Select a Token</label>
              <select 
                id="token-select" 
                bind:value={selectedTokenId}
                class="w-full px-3 py-2 border rounded-lg bg-kong-bg-secondary border-kong-border focus:outline-none focus:ring-2 focus:ring-kong-primary"
              >
                <option value={undefined}>-- No token selected --</option>
                {#each userTokens as token}
                  <option value={token.id}>{token.name}</option>
                {/each}
              </select>
            </div>
            <p class="text-sm text-kong-text-primary/60">
              Note: Your miner will be connected to the selected token's PoW canister, not its ledger canister.
            </p>
          {:else}
            <p class="text-sm text-kong-warning">
              You don't have any tokens yet. You can create a token first or connect your miner to a token later.
            </p>
          {/if}
        </div>
      </Panel>
    </div>

    <div class="grid gap-6 md:grid-cols-3">
      {#each minerTypes as { type, name, description, features }}
        <Panel>
          <div class="flex flex-col h-full p-6">
            <div class="flex-1">
              <h2 class="mb-2 text-xl font-semibold">{name}</h2>
              <p class="mb-6 text-kong-text-primary/60">{description}</p>

              <ul class="space-y-3">
                {#each features as feature}
                  <li class="flex items-center gap-2 text-sm">
                    <svg
                      class="w-5 h-5 text-kong-success"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {feature}
                  </li>
                {/each}
              </ul>
            </div>

            <div class="pt-6 mt-6 border-t border-kong-border">
              <button
                on:click={() => handleSubmit(type)}
                disabled={isSubmitting}
                class="w-full px-4 py-2 text-white transition-colors rounded-lg bg-kong-primary hover:bg-kong-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Creating..." : `Create ${name}`}
              </button>
            </div>
          </div>
        </Panel>
      {/each}
    </div>
  </div>
</div>
