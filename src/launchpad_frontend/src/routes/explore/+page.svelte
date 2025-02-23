<script lang="ts">
  let activeSection = '';

  const networks = {
    all: {
      id: 'all',
      title: 'EXPLORE ALL',
      icon: '⟁',
      status: 'ACTIVE',
      color: 'from-white/20 to-cyan-500/30',
      statusColor: 'text-white',
      description: 'View all tokens across networks',
      glow: 'shadow-[0_0_15px_rgba(255,255,255,0.15)]'
    },
    icp: {
      id: 'icp',
      title: 'INTERNET COMPUTER',
      icon: '◈',
      status: 'ACTIVE', 
      color: 'from-cyan-500/30 to-blue-500/30',
      statusColor: 'text-green-400',
      description: 'Explore ICP tokens and projects',
      glow: 'shadow-[0_0_15px_rgba(34,211,238,0.15)]'
    },
    sol: {
      id: 'sol',
      title: 'SOLANA',
      icon: '◎',
      status: 'IN PROGRESS',
      color: 'from-purple-500/30 to-pink-500/30',
      statusColor: 'text-yellow-400',
      description: 'Integration coming Q1 2025',
      glow: 'shadow-[0_0_15px_rgba(168,85,247,0.15)]'
    },
    eth: {
      id: 'eth',
      title: 'ETHEREUM',
      icon: '⟠',
      status: 'PLANNED',
      color: 'from-blue-500/30 to-indigo-500/30',
      statusColor: 'text-blue-400',
      description: 'Integration planned for Q3 2025',
      glow: 'shadow-[0_0_15px_rgba(59,130,246,0.15)]'
    },
    btc: {
      id: 'btc',
      title: 'BITCOIN',
      icon: '₿',
      status: 'PLANNED',
      color: 'from-orange-500/30 to-yellow-500/30',
      statusColor: 'text-orange-400',
      description: 'Integration planned for Q4 2025',
      glow: 'shadow-[0_0_15px_rgba(249,115,22,0.15)]'
    }
  };

  // Add demo tokens data
  const demoTokens = [
    { 
      symbol: 'KONG', 
      name: 'Kong Protocol',
      price: '1.234',
      change: '+12.34',
      volume: '1,234,567',
      marketCap: '12,345,678',
      holders: '1,234',
      status: 'ACTIVE'
    },
    { 
      symbol: 'PEPE', 
      name: 'Pepe Token',
      price: '0.00123',
      change: '-5.67',
      volume: '987,654',
      marketCap: '9,876,543',
      holders: '987',
      status: 'ACTIVE'
    },
    { 
      symbol: 'WOJAK', 
      name: 'Wojak Token',
      price: '0.0456',
      change: '+34.56',
      volume: '456,789',
      marketCap: '4,567,890',
      holders: '456',
      status: 'ACTIVE'
    },
    // Add more demo tokens as needed
  ];
</script>

<div class="h-[calc(100vh-104px)] flex flex-col">
  {#if !activeSection}
    <!-- Network Grid -->
    <div class="relative grid flex-1 grid-cols-2">
      <!-- Network Buttons -->
      {#each Object.values(networks).filter(n => n.id !== 'all') as network}
        <button class="relative group" on:click={() => activeSection = network.id}>
          <div class="relative h-full overflow-hidden transition-all duration-300 border bg-black/80 border-cyan-500/30 hover:border-cyan-400/50 {network.glow}">
            <!-- Background Effect -->
            <div class="absolute inset-0 transition-opacity duration-300 opacity-20 bg-gradient-to-br {network.color} group-hover:opacity-100"></div>
            
            <!-- Content -->
            <div class="relative flex flex-col h-full p-8">
              <div class="flex items-center justify-between mb-8">
                <div class="text-4xl text-cyan-400 drop-shadow-[0_0_3px_rgba(34,211,238,0.5)]">
                  {network.icon}
                </div>
                <span class="px-3 py-1.5 text-sm border {network.statusColor} border-cyan-500/30 shadow-[0_0_5px_rgba(34,211,238,0.1)]">
                  {network.status}
                </span>
              </div>
              
              <div class="flex flex-col items-center justify-center flex-1">
                <div class="flex flex-col items-center space-y-4">
                  <span class="font-mono text-2xl tracking-wider text-cyan-400 drop-shadow-[0_0_2px_rgba(34,211,238,0.3)]">{network.title}</span>
                  <div class="w-16 h-0.5 bg-cyan-500/30 shadow-[0_0_5px_rgba(34,211,238,0.2)]"></div>
                  <span class="text-base text-center text-cyan-400/70">{network.description}</span>
                </div>
              </div>
            </div>
          </div>
        </button>
      {/each}
    </div>
  {:else}
    <!-- Network Detail View -->
    <div class="flex-1">
      <div class="relative h-full border bg-black/90 border-cyan-500/30">
        <!-- Back Button -->
        <button class="absolute z-10 px-4 py-2 m-4 text-sm font-bold border border-cyan-500/30 hover:bg-cyan-500/10" on:click={() => activeSection = ''}>
          ← BACK
        </button>
        
        <!-- Content -->
        <div class="h-full p-8 pt-20 overflow-y-auto custom-scrollbar">
          {#if activeSection === 'icp'}
            <!-- ICP Token List Implementation -->
            <div class="space-y-6">
              <h2 class="text-2xl font-bold text-cyan-400 drop-shadow-[0_0_2px_rgba(34,211,238,0.3)]">ICP TOKENS</h2>
              
              <!-- Token List -->
              <div class="border divide-y divide-cyan-500/30 border-cyan-500/30">
                {#each demoTokens as token}
                  <div class="flex items-center justify-between p-4 transition-all duration-300 hover:bg-cyan-500/5">
                    <!-- Token Info -->
                    <div class="flex items-center space-x-4">
                      <div class="flex flex-col">
                        <span class="text-lg font-mono text-cyan-400">{token.symbol}</span>
                        <span class="text-sm text-cyan-400/70">{token.name}</span>
                      </div>
                    </div>

                    <!-- Price Info -->
                    <div class="flex items-center space-x-8">
                      <div class="flex flex-col items-end">
                        <span class="text-lg font-mono text-cyan-400">${token.price}</span>
                        <span class="text-sm {token.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}">
                          {token.change}%
                        </span>
                      </div>
                      
                      <!-- Volume -->
                      <div class="flex flex-col items-end">
                        <span class="text-sm text-cyan-400/70">VOL</span>
                        <span class="font-mono text-cyan-400">{token.volume}</span>
                      </div>

                      <!-- Market Cap -->
                      <div class="flex flex-col items-end">
                        <span class="text-sm text-cyan-400/70">MCap</span>
                        <span class="font-mono text-cyan-400">{token.marketCap}</span>
                      </div>

                      <!-- Holders -->
                      <div class="flex flex-col items-end">
                        <span class="text-sm text-cyan-400/70">Holders</span>
                        <span class="font-mono text-cyan-400">{token.holders}</span>
                      </div>

                      <!-- Status -->
                      <span class="px-2 py-1 text-xs border text-green-400 border-green-500/30">
                        {token.status}
                      </span>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {:else}
            <!-- Coming Soon Message -->
            <div class="flex flex-col items-center justify-center min-h-[calc(100%-5rem)] space-y-6">
              <span class="text-5xl drop-shadow-[0_0_3px_rgba(34,211,238,0.5)]">{networks[activeSection].icon}</span>
              <h2 class="text-3xl font-bold text-cyan-400 drop-shadow-[0_0_2px_rgba(34,211,238,0.3)]">{networks[activeSection].title}</h2>
              <span class="px-4 py-2 text-base border {networks[activeSection].statusColor} border-cyan-500/30 shadow-[0_0_5px_rgba(34,211,238,0.1)]">
                {networks[activeSection].status}
              </span>
              <p class="text-lg text-cyan-400/70">{networks[activeSection].description}</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Scrollbar styles */
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

  /* Transitions */
  button {
    transition: all 0.3s ease;
    margin: 0;
    padding: 0;
  }

  /* Grid styles */
  .grid {
    gap: 0;
    grid-auto-rows: 1fr;
  }

  /* Hover effects */
  button:hover .text-4xl {
    transform: scale(1.1);
    transition: transform 0.3s ease;
  }

  /* Grid borders */
  .grid > button:not(:last-child) {
    border-bottom: 1px solid rgba(34, 211, 238, 0.3);
  }

  .grid > button:nth-child(odd) {
    border-right: 1px solid rgba(34, 211, 238, 0.3);
  }
</style>

