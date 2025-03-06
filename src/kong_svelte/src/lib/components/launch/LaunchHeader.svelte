<script lang="ts">
  import { Zap, Users, Flame, Clock, Award, ChevronDown, ChevronUp } from "lucide-svelte";
  import { onMount } from "svelte";
  
  export let stats = {
    totalDeployments: 0,
    uniqueDeployers: 0,
    activityScore: 0,
    lastDeployment: null,
    totalTokens: 0,
    totalMiners: 0
  };
  
  export let pulseStats = false;
  
  // State for responsive collapsing
  let isExpanded = false;
  let isMobile = false;
  
  onMount(() => {
    // Check initial screen size
    checkScreenSize();
    
    // Add resize listener
    window.addEventListener('resize', checkScreenSize);
    
    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  });
  
  function checkScreenSize() {
    isMobile = window.innerWidth < 768;
    // Auto-collapse on mobile
    if (isMobile) {
      isExpanded = false;
    }
  }
  
  function toggleExpand() {
    isExpanded = !isExpanded;
  }
  
  // DEGEN FORMATTER: Make numbers look insane for visual satisfaction
  function formatNumber(num) {
    if (num === 0) return "0";
    if (num < 10) return num.toFixed(2);
    if (num < 1000) return Math.floor(num);
    return Math.floor(num).toLocaleString();
  }

  // Format time ago for last deployment
  function formatTimeAgo(date) {
    if (!date) return "Never";

    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
</script>

<!-- HEADER SECTION -->
<header class="relative z-10 border-b border-blue-500/50 backdrop-blur-sm">
  <div class="w-full px-6 py-4">
    <div class="flex flex-col md:flex-row justify-between items-center gap-4">
      
      <!-- DEGEN MINING TITLE -->
      <div class="mining-title-container mb-4 md:mb-0">
        <h1 class="mining-title text-2xl md:text-3xl font-bold font-mono text-center md:text-left">
          <span class="text-blue-400 glow-text">PROOF</span>
          <span class="text-white">-OF-</span>
          <span class="text-cyan-400 glow-text">MINING</span>
          <div class="mining-subtitle text-sm font-mono mt-1 text-center md:text-left">
            <span class="text-yellow-400">MINE</span> • 
            <span class="text-green-400">EARN</span> • 
            <span class="text-red-400">DEPLOY</span>
          </div>
        </h1>
        <div class="binary-overlay"></div>
      </div>
      
      <!-- MOBILE TOGGLE BUTTON -->
      {#if isMobile}
        <button 
          class="toggle-button mb-2 flex items-center justify-center gap-1 text-blue-400 font-mono text-sm"
          on:click={toggleExpand}
        >
          <span>{isExpanded ? 'HIDE STATS' : 'SHOW STATS'}</span>
          {#if isExpanded}
            <ChevronUp class="h-4 w-4" />
          {:else}
            <ChevronDown class="h-4 w-4" />
          {/if}
        </button>
      {/if}
      
      <!-- STATS CARDS ROW -->
      <div class={`stats-container flex flex-wrap gap-2 md:gap-4 justify-center md:justify-end ${isMobile && !isExpanded ? 'hidden' : ''}`}>
        <!-- PRIMARY STATS (ALWAYS VISIBLE ON DESKTOP) -->
        <div class="flex flex-wrap gap-2 md:gap-4 justify-center">
          <!-- TOTAL CANISTERS STAT -->
          <div class={`stat-card miner-card relative overflow-hidden ${pulseStats ? 'animate-pulse-fast' : ''}`}>
            <div class="stat-glow absolute"></div>
            <div class="flex items-center gap-2 relative z-10">
              <Zap class="h-5 w-5 text-purple-300 animate-pulse" />
              <div>
                <p class="text-xs text-purple-300 font-mono tracking-wider">TOTAL CANISTERS</p>
                <p class="text-xl font-bold font-mono">{formatNumber(stats.totalDeployments)}</p>
              </div>
            </div>
            <div class="stat-particles"></div>
          </div>
          
          <!-- ACTIVE USERS STAT -->
          <div class={`stat-card hashrate-card relative overflow-hidden ${pulseStats ? 'animate-pulse-fast' : ''}`}>
            <div class="stat-glow absolute"></div>
            <div class="flex items-center gap-2 relative z-10">
              <Users class="h-5 w-5 text-blue-300 animate-pulse" />
              <div>
                <p class="text-xs text-blue-300 font-mono tracking-wider">ACTIVE USERS</p>
                <p class="text-xl font-bold font-mono">{formatNumber(stats.uniqueDeployers)}</p>
              </div>
            </div>
            <div class="stat-particles"></div>
          </div>
          
          <!-- TOTAL TOKENS STAT -->
          <div class={`stat-card power-card relative overflow-hidden ${pulseStats ? 'animate-pulse-fast' : ''}`}>
            <div class="stat-glow absolute"></div>
            <div class="flex items-center gap-2 relative z-10">
              <Flame class="h-5 w-5 text-red-300 animate-pulse" />
              <div>
                <p class="text-xs text-red-300 font-mono tracking-wider">TOTAL TOKENS</p>
                <p class="text-xl font-bold font-mono">{formatNumber(stats.totalTokens)}</p>
              </div>
            </div>
            <div class="stat-particles"></div>
          </div>
          
          <!-- LAST BLOCK STAT -->
          <div class={`stat-card block-card relative overflow-hidden ${pulseStats ? 'animate-pulse-fast' : ''}`}>
            <div class="stat-glow absolute"></div>
            <div class="flex items-center gap-2 relative z-10">
              <Clock class="h-5 w-5 text-green-300 animate-pulse" />
              <div>
                <p class="text-xs text-green-300 font-mono tracking-wider">LAST BLOCK</p>
                <p class="text-xl font-bold font-mono">{formatTimeAgo(stats.lastDeployment)}</p>
              </div>
            </div>
            <div class="stat-particles"></div>
          </div>
        </div>
        
        <!-- SECONDARY STATS (ONLY VISIBLE WHEN EXPANDED ON MOBILE) -->
        <div class={`flex flex-wrap gap-2 md:gap-4 justify-center mt-2 md:mt-0 ${isMobile && !isExpanded ? 'hidden' : ''}`}>
          <!-- ACTIVITY SCORE STAT -->
          <div class={`stat-card activity-card relative overflow-hidden ${pulseStats ? 'animate-pulse-fast' : ''}`}>
            <div class="stat-glow absolute"></div>
            <div class="flex items-center gap-2 relative z-10">
              <Award class="h-5 w-5 text-yellow-300 animate-pulse" />
              <div>
                <p class="text-xs text-yellow-300 font-mono tracking-wider">ACTIVITY SCORE</p>
                <p class="text-xl font-bold font-mono">{formatNumber(stats.activityScore)}</p>
              </div>
            </div>
            <div class="stat-particles"></div>
          </div>
          
          <!-- TOTAL MINERS STAT -->
          <div class={`stat-card miners-total-card relative overflow-hidden ${pulseStats ? 'animate-pulse-fast' : ''}`}>
            <div class="stat-glow absolute"></div>
            <div class="flex items-center gap-2 relative z-10">
              <Users class="h-5 w-5 text-indigo-300 animate-pulse" />
              <div>
                <p class="text-xs text-indigo-300 font-mono tracking-wider">TOTAL MINERS</p>
                <p class="text-xl font-bold font-mono">{formatNumber(stats.totalMiners)}</p>
              </div>
            </div>
            <div class="stat-particles"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</header>

<style>
  /* ENHANCE EXISTING ELEMENTS */
  :global(.animate-pulse-fast) {
    animation: pulse-fast 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  @keyframes pulse-fast {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(1.03); }
  }
  
  /* ENHANCED STAT CARDS */
  .stat-card {
    @apply rounded-lg p-2 border shadow-lg;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    position: relative;
    transition: all 0.3s ease;
    min-width: 140px;
  }
  
  .stat-card:hover {
    transform: translateY(-2px) scale(1.02);
    z-index: 20;
  }
  
  .stat-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.2) 50%, transparent 60%);
    background-size: 200% 200%;
    animation: shine 3s linear infinite;
    pointer-events: none;
  }
  
  @keyframes shine {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  
  .stat-glow {
    inset: 0;
    filter: blur(20px);
    opacity: 0.5;
    mix-blend-mode: screen;
    pointer-events: none;
  }
  
  .stat-particles {
    position: absolute;
    inset: 0;
    opacity: 0.4;
    pointer-events: none;
    mix-blend-mode: screen;
  }
  
  /* MINER CARD STYLING */
  .miner-card {
    border-color: rgba(59, 130, 246, 0.5);
    box-shadow: 0 0 15px rgba(59, 130, 246, 0.3);
  }
  
  .miner-card .stat-glow {
    background: radial-gradient(circle at center, rgba(59, 130, 246, 0.6), transparent 70%);
  }
  
  .miner-card .stat-particles {
    background-image: 
      radial-gradient(circle at 20% 30%, rgba(59, 130, 246, 0.8) 1px, transparent 1px),
      radial-gradient(circle at 80% 40%, rgba(59, 130, 246, 0.8) 1px, transparent 1px),
      radial-gradient(circle at 40% 70%, rgba(59, 130, 246, 0.8) 1px, transparent 1px);
    background-size: 100% 100%;
    animation: particle-drift 10s linear infinite;
  }
  
  /* HASHRATE CARD STYLING */
  .hashrate-card {
    border-color: rgba(59, 130, 246, 0.5);
    box-shadow: 0 0 15px rgba(59, 130, 246, 0.3);
  }
  
  .hashrate-card .stat-glow {
    background: radial-gradient(circle at center, rgba(59, 130, 246, 0.6), transparent 70%);
  }
  
  .hashrate-card .stat-particles {
    background-image: 
      radial-gradient(circle at 30% 20%, rgba(59, 130, 246, 0.8) 1px, transparent 1px),
      radial-gradient(circle at 70% 50%, rgba(59, 130, 246, 0.8) 1px, transparent 1px),
      radial-gradient(circle at 50% 80%, rgba(59, 130, 246, 0.8) 1px, transparent 1px);
    background-size: 100% 100%;
    animation: particle-drift 12s linear infinite reverse;
  }
  
  /* POWER CARD STYLING */
  .power-card {
    border-color: rgba(239, 68, 68, 0.5);
    box-shadow: 0 0 15px rgba(239, 68, 68, 0.3);
  }
  
  .power-card .stat-glow {
    background: radial-gradient(circle at center, rgba(239, 68, 68, 0.6), transparent 70%);
  }
  
  .power-card .stat-particles {
    background-image: 
      radial-gradient(circle at 10% 40%, rgba(239, 68, 68, 0.8) 1px, transparent 1px),
      radial-gradient(circle at 60% 30%, rgba(239, 68, 68, 0.8) 1px, transparent 1px),
      radial-gradient(circle at 80% 60%, rgba(239, 68, 68, 0.8) 1px, transparent 1px);
    background-size: 100% 100%;
    animation: particle-drift 8s linear infinite;
  }
  
  /* BLOCK CARD STYLING */
  .block-card {
    border-color: rgba(16, 185, 129, 0.5);
    box-shadow: 0 0 15px rgba(16, 185, 129, 0.3);
  }
  
  .block-card .stat-glow {
    background: radial-gradient(circle at center, rgba(16, 185, 129, 0.6), transparent 70%);
  }
  
  .block-card .stat-particles {
    background-image: 
      radial-gradient(circle at 25% 25%, rgba(16, 185, 129, 0.8) 1px, transparent 1px),
      radial-gradient(circle at 75% 35%, rgba(16, 185, 129, 0.8) 1px, transparent 1px),
      radial-gradient(circle at 45% 75%, rgba(16, 185, 129, 0.8) 1px, transparent 1px);
    background-size: 100% 100%;
    animation: particle-drift 15s linear infinite alternate;
  }
  
  /* ACTIVITY CARD STYLING */
  .activity-card {
    border-color: rgba(234, 179, 8, 0.5);
    box-shadow: 0 0 15px rgba(234, 179, 8, 0.3);
  }
  
  .activity-card .stat-glow {
    background: radial-gradient(circle at center, rgba(234, 179, 8, 0.6), transparent 70%);
  }
  
  .activity-card .stat-particles {
    background-image: 
      radial-gradient(circle at 15% 35%, rgba(234, 179, 8, 0.8) 1px, transparent 1px),
      radial-gradient(circle at 65% 25%, rgba(234, 179, 8, 0.8) 1px, transparent 1px),
      radial-gradient(circle at 85% 65%, rgba(234, 179, 8, 0.8) 1px, transparent 1px);
    background-size: 100% 100%;
    animation: particle-drift 9s linear infinite;
  }
  
  /* MINERS TOTAL CARD STYLING */
  .miners-total-card {
    border-color: rgba(99, 102, 241, 0.5);
    box-shadow: 0 0 15px rgba(99, 102, 241, 0.3);
  }
  
  .miners-total-card .stat-glow {
    background: radial-gradient(circle at center, rgba(99, 102, 241, 0.6), transparent 70%);
  }
  
  .miners-total-card .stat-particles {
    background-image: 
      radial-gradient(circle at 35% 15%, rgba(99, 102, 241, 0.8) 1px, transparent 1px),
      radial-gradient(circle at 75% 45%, rgba(99, 102, 241, 0.8) 1px, transparent 1px),
      radial-gradient(circle at 55% 85%, rgba(99, 102, 241, 0.8) 1px, transparent 1px);
    background-size: 100% 100%;
    animation: particle-drift 11s linear infinite alternate;
  }
  
  /* MINING TITLE STYLING */
  .mining-title-container {
    position: relative;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(59, 130, 246, 0.3);
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.2);
    overflow: hidden;
  }
  
  .mining-title {
    position: relative;
    z-index: 10;
    letter-spacing: 1px;
    text-shadow: 0 0 10px currentColor;
  }
  
  .mining-subtitle {
    opacity: 0.8;
    letter-spacing: 1px;
  }
  
  .glow-text {
    animation: glow-pulse 2s ease-in-out infinite alternate;
  }
  
  @keyframes glow-pulse {
    0% { text-shadow: 0 0 5px currentColor; }
    100% { text-shadow: 0 0 15px currentColor, 0 0 20px currentColor; }
  }
  
  .binary-overlay {
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Ctext x='10' y='20' font-family='monospace' font-size='10' fill='rgba(255,255,255,0.1)'%3E10110%3C/text%3E%3Ctext x='50' y='40' font-family='monospace' font-size='10' fill='rgba(255,255,255,0.1)'%3E01001%3C/text%3E%3Ctext x='20' y='60' font-family='monospace' font-size='10' fill='rgba(255,255,255,0.1)'%3E11010%3C/text%3E%3Ctext x='70' y='80' font-family='monospace' font-size='10' fill='rgba(255,255,255,0.1)'%3E00101%3C/text%3E%3C/svg%3E");
    opacity: 0.2;
    pointer-events: none;
    z-index: 1;
  }
  
  @keyframes particle-drift {
    0% { background-position: 0% 0%; }
    100% { background-position: 100% 100%; }
  }
  
  /* TOGGLE BUTTON STYLING */
  .toggle-button {
    padding: 0.25rem 0.75rem;
    border-radius: 0.25rem;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(59, 130, 246, 0.3);
    transition: all 0.2s ease;
  }
  
  .toggle-button:hover {
    background: rgba(59, 130, 246, 0.2);
    transform: translateY(-1px);
  }
  
  .toggle-button:active {
    transform: translateY(0);
  }
  
  /* RESPONSIVE CONTAINER TRANSITIONS */
  .stats-container {
    transition: all 0.3s ease;
  }
  
  @media (max-width: 767px) {
    .stats-container {
      max-height: 1000px;
      overflow: hidden;
    }
    
    .stats-container.hidden {
      max-height: 0;
      opacity: 0;
      margin: 0;
      padding: 0;
    }
  }
</style> 