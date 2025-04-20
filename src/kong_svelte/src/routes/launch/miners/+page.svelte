<script lang="ts">
  import { onMount } from "svelte";
  import { createEventDispatcher } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { Pickaxe, Network, Rocket, Coins, Loader2, CheckCircle2, X } from "lucide-svelte";
  import Panel from "$lib/components/common/Panel.svelte";

  // Miner configs
  const miners = [
    {
      id: 1,
      name: "ICP Miner",
      description: "Can only mine ICP tokens.",
      price: 100,
      token: "KONG",
      icon: Pickaxe,
      tokens: [
        { symbol: "ICP", icon: Network }
      ]
    },
    {
      id: 2,
      name: "Multichain Miner",
      description: "Future support for SOL, SUI, ETH, BTC (coming soon)",
      price: 250,
      token: "KONG",
      icon: Rocket,
      tokens: [
        { symbol: "SOL", icon: Coins },
        { symbol: "SUI", icon: Coins },
        { symbol: "ETH", icon: Coins },
        { symbol: "BTC", icon: Coins }
      ],
      comingSoon: true
    }
  ];

  let showModal = false;
  let selectedMiner = null;
  let progressStep = 0;
  let progressText = "";
  let isDeploying = false;
  let deployDone = false;

  function openModal(miner) {
    selectedMiner = miner;
    showModal = true;
    progressStep = 0;
    progressText = "";
    isDeploying = false;
    deployDone = false;
  }

  function closeModal() {
    showModal = false;
    progressStep = 0;
    progressText = "";
    isDeploying = false;
    deployDone = false;
  }

  async function deploy_miner() {
    isDeploying = true;
    progressStep = 1;
    progressText = "Sending payment...";
    await new Promise((r) => setTimeout(r, 2000));
    progressStep = 2;
    progressText = "Payment received, creating canister...";
    await new Promise((r) => setTimeout(r, 1000));
    progressStep = 3;
    progressText = "Installing miner module...";
    await new Promise((r) => setTimeout(r, 1000));
    progressStep = 4;
    progressText = "Finalizing...";
    await new Promise((r) => setTimeout(r, 4000));
    progressStep = 5;
    progressText = "Done! Miner launched.";
    deployDone = true;
  }
</script>

<svelte:head>
  <title>Launch ICP Miners - KongSwap</title>
  <meta name="description" content="Demo page for launching miners with Kong tokens." />
</svelte:head>

<div class="min-h-screen bg-kong-bg text-kong-text-primary px-4 py-8">
  <div class="max-w-4xl mx-auto">
    <h1 class="text-3xl font-bold mb-6 text-center">Start Mining on Internet Computer</h1>
    <div class="grid gap-6 md:grid-cols-2">
      {#each miners as miner}
        <Panel className="flex flex-col h-full items-center p-6" variant="transparent" roundness="rounded-xl">
          <div class="flex-1 w-full flex flex-col items-center gap-4">
            <div class="flex items-center justify-center w-14 h-14 rounded-lg bg-kong-bg-light/30 mb-1">
              <svelte:component this={miner.icon} size={32} class="text-kong-primary" />
            </div>
            <h2 class="text-xl font-semibold">{miner.name}</h2>
            <p class="text-kong-text-secondary text-sm mb-2 text-center">{miner.description}</p>
            <div class="flex gap-2 flex-wrap items-center justify-center mb-1">
              {#each miner.tokens as t}
                <span class="flex items-center gap-1 px-2 py-1 rounded bg-kong-bg-light/20 text-xs text-kong-text-primary border border-kong-border/30">
                  <svelte:component this={t.icon} size={14} class="text-kong-text-secondary" /> {t.symbol}
                </span>
              {/each}
              {#if miner.comingSoon}
                <span class="ml-2 px-2 py-1 rounded bg-kong-bg-light/20 text-xs text-kong-text-secondary border border-kong-border/30">coming soon</span>
              {/if}
            </div>
            <div class="flex items-center gap-2 mt-2">
              <span class="font-bold text-lg">{miner.price}</span>
              <span class="bg-kong-bg-light/20 text-green-500 px-2 py-1 rounded text-xs font-medium">{miner.token}</span>
            </div>
          </div>
          <button
            class="mt-4 w-full py-2 rounded-lg font-semibold transition disabled:opacity-60 bg-kong-primary text-white hover:bg-kong-primary/90 focus:ring-2 focus:ring-kong-primary/30"
            on:click={() => openModal(miner)}
            disabled={miner.comingSoon}
          >
            {miner.comingSoon ? 'Coming Soon' : 'Launch'}
          </button>
        </Panel>
      {/each}
    </div>

  </div>

  {#if showModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" transition:fade>
      <Panel className="relative w-full max-w-md p-8 flex flex-col" variant="solid" roundness="rounded-2xl">
        <button class="absolute top-4 right-4 text-kong-text-secondary hover:text-kong-primary" on:click={closeModal} aria-label="Close">
          <X size={24} />
        </button>
        <h3 class="text-2xl font-bold mb-2 text-center">Launch {selectedMiner.name}</h3>
        <div class="mb-2 text-center">
          <span class="font-bold text-green-500 text-xl">{selectedMiner.price} {selectedMiner.token}</span>
        </div>
        <p class="mb-4 text-kong-text-secondary">Pay this amount to launch this miner.</p>
        {#if !isDeploying && !deployDone}
          <button
            class="w-full py-2 rounded-lg font-semibold transition bg-kong-primary text-white hover:bg-kong-primary/90 focus:ring-2 focus:ring-kong-primary/30"
            on:click={deploy_miner}
          >
            Pay
          </button>
        {/if}
        {#if isDeploying || deployDone}
          <div class="mt-6 flex flex-col gap-4 items-center">
            {#if !deployDone}
              <Loader2 class="animate-spin text-kong-primary" size={36} />
              <div class="font-medium text-lg">{progressText}</div>
            {/if}
            {#if deployDone}
              <CheckCircle2 class="text-green-500" size={36} />
              <div class="font-bold text-lg">{progressText}</div>
              <button class="mt-4 bg-kong-primary text-white px-4 py-2 rounded-lg font-semibold" on:click={closeModal}>Close</button>
            {/if}
          </div>
        {/if}
      </Panel>
    </div>
  {/if}
</div>

<style>
  :global(.bg-kong-bg) {
    /* Inherit from layout, no override */
  }
  :global(.bg-kong-bg-light) {
    @apply bg-white/[0.04];
  }
  :global(.text-kong-primary) {
    @apply text-blue-400; /* Use your brand blue or adjust as needed */
  }
  :global(.bg-kong-primary) {
    @apply bg-blue-500; /* Use your brand blue or adjust as needed */
  }
  :global(.border-kong-border) {
    @apply border-gray-800;
  }
  :global(.text-kong-text-primary) {
    @apply text-white;
  }
  :global(.text-kong-text-secondary) {
    @apply text-gray-400;
  }
</style>
