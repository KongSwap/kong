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

  let selectedType: MinerType = { Normal: null };
  let isSubmitting = false;

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
      // TODO: Replace with actual API call
      // TODO: Replace with actual principal
      const initArgs: MinerInitArgs = {
        owner: null as any, // Will be set by the backend
      };

      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log("Creating miner with type:", type);
      goto("/launch");
    } catch (error) {
      console.error("Error creating miner:", error);
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
