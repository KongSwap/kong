<!-- src/launchpad_frontend/src/routes/+page.svelte -->

<script lang="ts">
  import { onMount } from "svelte";
  import { isConnected, backendActor } from '$lib/stores/wallet';
  import type { MinersList } from '$lib/types';
  import Login from "$lib/components/Login.svelte";

  let minersList: MinersList = [];
  let canisterCycles = "0";
  let canisterIcp = "0";
  let totalMiners = 0;
  let totalTokensLaunched = 0; 
  let totalKongBurned = 0;
  let recentTokens: any[] = [];
  let recentMiners: any[] = [];
  let totalValueLocked = 0;
  let dailyActiveMiners = 0;
  let showWalletModal = false;

  // Active tab state and section details
  let activeTab = 'overview';
  let activeSection = ''; // '', 'info', 'tokens', 'analytics', 'roadmap'

  // Demo data for development
  const demoTokens = [
    { name: "Quantum Token", ticker: "QNTM", supply: 1000000000, timestamp: Date.now() - 86400000 },
    { name: "Neural Network", ticker: "NNET", supply: 500000000, timestamp: Date.now() - 172800000 },
    { name: "Cyber Credit", ticker: "CCRD", supply: 750000000, timestamp: Date.now() - 259200000 },
    { name: "Digital Dawn", ticker: "DAWN", supply: 250000000, timestamp: Date.now() - 345600000 },
    { name: "Matrix Gold", ticker: "MTRX", supply: 888888888, timestamp: Date.now() - 432000000 }
  ];

  const demoMiners = [
    { id: "M-001", type: "Quantum", hashrate: "1.2T", timestamp: Date.now() - 43200000 },
    { id: "M-002", type: "Neural", hashrate: "985G", timestamp: Date.now() - 129600000 },
    { id: "M-003", type: "Quantum", hashrate: "1.5T", timestamp: Date.now() - 216000000 },
    { id: "M-004", type: "Cyber", hashrate: "750G", timestamp: Date.now() - 302400000 },
    { id: "M-005", type: "Matrix", hashrate: "2.1T", timestamp: Date.now() - 388800000 }
  ];

  const demoActivity = [
    { type: 'MINT', details: 'New Quantum Miner Deployed', value: '500 KONG', timestamp: Date.now() - 3600000 },
    { type: 'BURN', details: 'Token Launch: CYBER', value: '1200 KONG', timestamp: Date.now() - 7200000 },
    { type: 'MINE', details: 'Block Reward: QNTM', value: '50 QNTM', timestamp: Date.now() - 10800000 },
    { type: 'STAKE', details: 'Miner Upgrade', value: '800 KONG', timestamp: Date.now() - 14400000 },
    { type: 'MINT', details: 'Neural Miner Deployed', value: '500 KONG', timestamp: Date.now() - 18000000 }
  ];

  const tabs = [
    { id: 'overview', label: 'OVERVIEW', icon: '📊', description: 'Real-time metrics and top performers' },
    { id: 'activity', label: 'ACTIVITY', icon: '⚡', description: 'Latest protocol transactions' },
    { id: 'roadmap', label: 'ROADMAP', icon: '🗺️', description: 'Development milestones and future plans' }
  ];

  const sections = {
    info: {
      id: 'info',
      title: 'INFO',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6">
        <path d="M12 8V12M12 16H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"/>
      </svg>`,
      color: 'from-cyan-500/20 to-blue-500/20',
      content: [
        { title: 'KONG Protocol', text: 'First proof-of-work token launchpad built on Internet Computer' },
        { title: 'Token Mechanics', text: 'Launch new tokens and create miners by burning $KONG tokens' },
        { title: 'Mining Network', text: 'Deploy and manage your own fleet of decentralized mining nodes' },
        { title: 'Economic Model', text: 'Sustainable token economy driven by continuous $KONG burning' }
      ]
    },
    tokens: {
      id: 'tokens',
      title: 'PERFORMANCE',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6">
        <path d="M2 10H6M2 14H6M6 10V18C6 19.1046 6.89543 20 8 20H16C17.1046 20 18 19.1046 18 18V10M6 14V6C6 4.89543 6.89543 4 8 4H16C17.1046 4 18 4.89543 18 6V14M18 10H22M18 14H22" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"/>
      </svg>`,
      color: 'from-purple-500/20 to-pink-500/20',
      metrics: [
        { label: 'Tokens Launched', value: totalTokensLaunched },
        { label: 'KONG Burned', value: `${totalKongBurned} KONG` },
        { label: 'Daily Volume', value: '$2.45M' },
        { label: 'Launch Success Rate', value: '94%' }
      ]
    },
    analytics: {
      id: 'analytics',
      title: 'METRICS',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6">
        <path d="M8 16V18M12 12V18M16 8V18M4 20H20C21.1046 20 22 19.1046 22 18V6C22 4.89543 21.1046 4 20 4H4C2.89543 4 2 4.89543 2 6V18C2 19.1046 2.89543 20 4 20Z" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"/>
      </svg>`,
      color: 'from-emerald-500/20 to-cyan-500/20',
      stats: [
        { label: 'Total Value Locked', value: `$${totalValueLocked.toLocaleString()}` },
        { label: 'Online Miners', value: dailyActiveMiners },
        { label: 'Network Power', value: '1.2 TH/s' },
        { label: 'Network Status', value: '98.5% Uptime' }
      ]
    },
    roadmap: {
      id: 'roadmap',
      title: 'ROADMAP',
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6">
        <path d="M4 4V20M4 4L8 8M4 4L8 2M4 20L8 16M4 20L8 22M20 4V20M20 4L16 8M20 4L16 2M20 20L16 16M20 20L16 22" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"/>
      </svg>`,
      color: 'from-red-500/20 to-orange-500/20',
      phases: [
        { phase: 'Launch Phase', status: 'COMPLETE', items: ['Token Launchpad', 'Mining Infrastructure'] },
        { phase: 'Growth Phase', status: 'IN PROGRESS', items: ['Performance Metrics', 'Multi-Chain Support'] },
        { phase: 'Expansion Phase', status: 'PLANNED', items: ['Community Governance', 'Mobile App'] }
      ]
    }
  };

  // Function to toggle wallet modal
  function toggleWalletModal() {
    showWalletModal = !showWalletModal;
  }

  // Function to handle successful login
  function handleLogin() {
    showWalletModal = false;
    // Add any additional logic needed after successful login
  }

  onMount(async () => {
    if ($isConnected && $backendActor) {
      try {
        minersList = await $backendActor.get_created_miners();
        totalMiners = minersList.length;
        totalTokensLaunched = await $backendActor.get_total_tokens_launched();
        totalKongBurned = await $backendActor.get_total_kong_burned();
        
        const cyclesBalance = await $backendActor.get_canister_cycles();
        canisterCycles = (Number(cyclesBalance) / 1_000_000_000_000).toFixed(2) + "T";
        const icpBalance = await $backendActor.get_canister_icp();
        canisterIcp = (Number(icpBalance) / 100_000_000).toFixed(4);

        recentTokens = await $backendActor.get_recent_tokens(5);
        recentMiners = await $backendActor.get_recent_miners(5);
        
        dailyActiveMiners = await $backendActor.get_daily_active_miners();
        totalValueLocked = await $backendActor.get_total_value_locked();
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      }
    } else {
      // Use demo data when not connected
      recentTokens = demoTokens;
      recentMiners = demoMiners;
      totalMiners = 156;
      totalTokensLaunched = 89;
      totalKongBurned = 1250000;
      totalValueLocked = 4500000;
      dailyActiveMiners = 78;
    }
  });
</script>

<!-- Add the wallet modal -->
{#if showWalletModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
    <Login 
      on:close={toggleWalletModal} 
      on:login={handleLogin}
    />
  </div>
{/if}

<!-- Main container -->
<div class="h-[calc(100dvh-104px)] flex flex-col">
  {#if !activeSection}
    <!-- Overview Grid -->
    <div class="relative grid flex-1 grid-cols-1 gap-1 md:grid-cols-2">
      {#each Object.values(sections) as section}
        <button class="relative h-full group" on:click={() => activeSection = section.id}>
          <div class="relative h-full overflow-hidden transition-all duration-300 border bg-black/80 border-cyan-500/30 hover:border-cyan-400/50">
            <!-- Background Effect -->
            <div class="absolute inset-0 transition-opacity duration-300 opacity-20 bg-gradient-to-br {section.color} group-hover:opacity-100"></div>
            
            <!-- Content -->
            <div class="relative flex flex-col h-full p-8">
              <div class="flex items-center justify-between mb-8">
                <div class="text-4xl text-cyan-400 drop-shadow-[0_0_3px_rgba(34,211,238,0.5)]">
                  {@html section.icon}
                </div>
                <span class="px-3 py-1.5 text-sm border text-cyan-400 border-cyan-500/30 shadow-[0_0_5px_rgba(34,211,238,0.1)]">
                  {section.title}
                </span>
              </div>
              
              <div class="flex flex-col items-center justify-center flex-1">
                <div class="flex flex-col items-center space-y-4">
                  <span class="font-mono text-2xl tracking-wider text-cyan-400 drop-shadow-[0_0_2px_rgba(34,211,238,0.3)]">
                    {section.title}
                  </span>
                  <div class="w-16 h-0.5 bg-cyan-500/30 shadow-[0_0_5px_rgba(34,211,238,0.2)]"></div>
                  {#if section.content}
                    <span class="text-base text-center text-cyan-400/70">
                      {section.content[0].text}
                    </span>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        </button>
      {/each}
    </div>
  {:else}
    <!-- Expanded Section Content -->
    <div class="flex-1">
      <div class="relative h-full border bg-black/90 border-cyan-500/30">
        <!-- Single Back Button (top-left) -->
        <button class="absolute px-4 py-2 text-sm font-bold border top-4 left-4 border-cyan-500/30 hover:bg-cyan-500/10" on:click={() => activeSection = ''}>
          ← BACK
        </button>
        <!-- Internal Container with internal padding and gap -->
        <div class="p-4 space-y-4">
          <!-- Section Header: Render SVG icon correctly -->
          <div class="flex items-center justify-center">
            <span class="mr-4 text-3xl">{@html sections[activeSection].icon}</span>
            <h2 class="text-2xl font-bold text-cyan-400">{sections[activeSection].title}</h2>
          </div>
          <!-- Dynamic Content Based on Section -->
          {#if activeSection === 'info'}
            <div class="grid gap-4 md:grid-cols-2">
              {#each sections.info.content as item}
                <div class="p-4 transition-colors border border-cyan-500/30 hover:bg-cyan-500/5">
                  <h3 class="text-lg font-bold text-white">{item.title}</h3>
                  <p class="mt-2 text-cyan-400/70">{item.text}</p>
                </div>
              {/each}
            </div>
          {:else if activeSection === 'tokens'}
            <div class="grid gap-4 md:grid-cols-2">
              {#each sections.tokens.metrics as metric}
                <div class="p-4 border border-cyan-500/30">
                  <div class="text-sm text-cyan-400">{metric.label}</div>
                  <div class="mt-2 text-2xl font-bold text-white">{metric.value}</div>
                </div>
              {/each}
            </div>
          {:else if activeSection === 'analytics'}
            <div class="grid gap-4 md:grid-cols-2">
              {#each sections.analytics.stats as stat}
                <div class="p-4 border border-cyan-500/30">
                  <div class="text-sm text-cyan-400">{stat.label}</div>
                  <div class="mt-2 text-2xl font-bold text-white">{stat.value}</div>
                </div>
              {/each}
            </div>
          {:else if activeSection === 'roadmap'}
            <div class="space-y-1">
              {#each sections.roadmap.phases as phase}
                <div class="p-4 border border-cyan-500/30 bg-black/40">
                  <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center space-x-3">
                      <span class="inline-block w-1.5 h-1.5 bg-cyan-400"></span>
                      <h3 class="font-mono text-xl text-white">{phase.phase}</h3>
                    </div>
                    <span class="px-2 py-1 font-mono text-xs border border-cyan-500/30 text-cyan-400">{phase.status}</span>
                  </div>
                  <div class="ml-6 space-y-2">
                    {#each phase.items as item}
                      <div class="flex items-center group">
                        <span class="mr-3 text-cyan-500/50">→</span>
                        <span class="font-mono text-sm text-cyan-400/70 group-hover:text-cyan-400">{item}</span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: rgba(34, 211, 238, 0.3) transparent;
  }
  .custom-scrollbar::-webkit-scrollbar {
    width: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(34, 211, 238, 0.3);
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(34, 211, 238, 0.5);
  }
  .animate-scroll {
    display: inline-flex;
    animation: scroll 30s linear infinite;
    white-space: nowrap;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  /* Ensure SVG renders properly */
  :global(svg) {
    display: inline-block;
    vertical-align: middle;
  }
  :global(svg path) {
    stroke-width: 1.5;
  }
  .group:hover .text-cyan-500\/50 {
    @apply text-cyan-400;
  }

  /* Add grid-specific styles */
  @media (min-width: 768px) {
    .grid {
      grid-auto-rows: 1fr;
    }
  }

  /* Add hover effects */
  button:hover .text-4xl {
    transform: scale(1.1);
    transition: transform 0.3s ease;
  }

  /* Enhance transitions */
  .text-4xl {
    transition: transform 0.3s ease;
  }

  /* Ensure the container takes full height and handles overflow properly */
  :global(body) {
    overflow: hidden;
  }

  @keyframes scroll {
    0% {
      transform: translateX(100%);
    }
    100% {
      transform: translateX(-100%);
    }
  }
</style>
