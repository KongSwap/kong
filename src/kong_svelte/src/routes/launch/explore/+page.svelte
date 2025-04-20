<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import { goto } from '$app/navigation';
  import { Pickaxe, Network, Rocket, Coins, Laugh, Flame, Zap } from "lucide-svelte";

  // Demo tokens with randomized stats
function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomFloat(min: number, max: number, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}
function getAccent(symbol: string) {
  switch(symbol) {
    case 'ICP': return 'linear-gradient(90deg,#6366f1,#0ea5e9)';
    case 'PEPE': return 'linear-gradient(90deg,#A855F7,#EC4899)';
    case 'PUMP': return 'linear-gradient(90deg,#F97316,#EF4444)';
    case 'MEME': return 'linear-gradient(90deg,#8B5CF6,#6366F1)';
    default: return 'linear-gradient(90deg,#3B82F6,#06B6D4)';
  }
}

const tokens = [
  {
    symbol: "ICP",
    name: "Internet Computer Protocol",
    icon: Pickaxe,
    status: "Available",
    description: "The native token of the Internet Computer.",
  },
  {
    symbol: "PEPE",
    name: "Pepe Coin (Demo)",
    icon: Laugh,
    status: "Demo",
    description: "A meme coin for testing. Not real.",
  },
  {
    symbol: "PUMP",
    name: "PumpFun (Demo)",
    icon: Flame,
    status: "Demo",
    description: "Testnet token for pump.fun style experiments.",
  },
  {
    symbol: "MEME",
    name: "Meme Token (Demo)",
    icon: Zap,
    status: "Demo",
    description: "Another fun demo token. Not real.",
  },
  {
    symbol: "SOL",
    name: "Solana",
    icon: Network,
    status: "Coming Soon",
    description: "Solana support coming soon.",
  },
  {
    symbol: "SUI",
    name: "Sui",
    icon: Rocket,
    status: "Coming Soon",
    description: "Sui support coming soon.",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    icon: Coins,
    status: "Coming Soon",
    description: "Ethereum support coming soon.",
  },
  {
    symbol: "BTC",
    name: "Bitcoin",
    icon: Coins,
    status: "Coming Soon",
    description: "Bitcoin support coming soon.",
  }
].map((token) => {
  // Randomize stats for each token
  const totalSupply = randomInt(1_000_000, 10_000_000);
  const circSupply = randomInt(100_000, totalSupply);
  const percentMined = Math.round((circSupply / totalSupply) * 100);
  const reward = randomFloat(100, 2000, 2);
  const activeMiners = randomInt(5, 5000);
  return {
    ...token,
    totalSupply,
    circSupply,
    percentMined,
    reward,
    activeMiners,
    price: randomFloat(0.0000001, 0.00001, 8),
    tvl: randomInt(1000, 100000),
    volume: randomInt(500, 100000),
  };
});

let sortField: 'created' | 'marketCap' | 'volume' | 'activeMiners' = 'created';
let filteredTokens = tokens;

// Animate the mined bar
import { onMount } from 'svelte';
let animatedPercents: number[] = Array(tokens.length).fill(0);
onMount(() => {
  tokens.forEach((token, i) => {
    setTimeout(() => {
      animatedPercents[i] = token.percentMined;
    }, 200 + i * 120);
  });
});
</script>

<svelte:head>
  <title>Explore Minable Tokens - KongSwap</title>
  <meta name="description" content="Explore all tokens available for mining on KongSwap." />
</svelte:head>

<div class="min-h-screen bg-kong-bg text-kong-text-primary px-4 py-8">
  <div class="w-full">
    <h1 class="text-4xl font-black mb-4 text-center tracking-tight">Meme Tokens: Mine the Madness</h1>
    <p class="text-center text-kong-text-secondary mb-10 text-lg">The wildest meme coins on the Internet Computer. Mine, flex, and degen. <span class="text-green-400 font-semibold">How much will you mine?</span></p>
    <div class="flex flex-col gap-6">
      <div class="flex justify-center gap-3 mb-8">
        <button class={`kong-btn-sm ${sortField === 'created' ? 'bg-kong-primary text-white' : 'bg-kong-gray-500 text-white hover:bg-kong-gray-600'}`} on:click={() => sortField = 'created'}>
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="mr-1"><circle cx="12" cy="12" r="10"/></svg>
          Created
        </button>
        <button class={`kong-btn-sm ${sortField === 'marketCap' ? 'bg-kong-primary text-white' : 'bg-kong-gray-500 text-white hover:bg-kong-gray-600'}`} on:click={() => sortField = 'marketCap'}>
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="mr-1"><path d="M3 17v-2a4 4 0 014-4h10a4 4 0 014 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Market Cap
        </button>
        <button class={`kong-btn-sm ${sortField === 'volume' ? 'bg-kong-primary text-white' : 'bg-kong-gray-500 text-white hover:bg-kong-gray-600'}`} on:click={() => sortField = 'volume'}>
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="mr-1"><path d="M4 17v-8a4 4 0 014-4h8a4 4 0 014 4v8"/><rect x="8" y="21" width="8" height="2" rx="1"/></svg>
          Volume
        </button>
        <button class={`kong-btn-sm ${sortField === 'activeMiners' ? 'bg-kong-primary text-white' : 'bg-kong-gray-500 text-white hover:bg-kong-gray-600'}`} on:click={() => sortField = 'activeMiners'}>
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="mr-1"><path d="M7 20v-2a4 4 0 014-4h2a4 4 0 014 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Active Miners
        </button>
      </div>
      <div class="token-grid">
        {#if filteredTokens.length === 0}
          <div class="no-tokens-found">
            <div class="text-center py-12">
              <div class="w-20 h-20 rounded-full bg-orange-900/30 flex items-center justify-center mx-auto mb-6">
                <span class="text-5xl">🦍</span>
              </div>
              <p class="text-2xl font-black mb-3 text-white">NO MEME TOKENS YET</p>
              <p class="text-orange-400 mb-8 max-w-md mx-auto">Launch the first meme token and become a legend.</p>
            </div>
          </div>
        {:else}
          {#each filteredTokens as token, i}
  <Panel
    className="token-card-panel group token-card-clickable compact"
    variant="transparent"
    roundness="rounded-xl"
    on:click={() => goto(`/launch/explore/${token.symbol}`)}
  >
    <div class="card-accent" style="background:{getAccent(token.symbol)}"></div>
    <div class="token-card-bg"></div>
    <div class="token-card-content flex flex-col h-full">
      <!-- Top: Icon + Title + Symbol -->
      <div class="flex items-center gap-3 mb-2">
        <div class="flex items-center justify-center w-14 h-14 rounded-lg bg-kong-bg-light/30 group-hover:scale-105 transition-transform duration-200">
          <svelte:component this={token.icon} size={36} class="text-kong-primary" />
        </div>
        <div>
          <h2 class="token-title text-base font-bold mb-0.5">{token.name}</h2>
          <div class="token-symbol text-xs">{token.symbol}</div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-x-2 gap-y-1 text-xs mb-2 token-stats">
        <div class="flex flex-col items-center"><span class="stat-label">Price</span><span class="stat-value">${token.price}</span></div>
        <div class="flex flex-col items-center"><span class="stat-label">TVL</span><span class="stat-value">${token.tvl.toLocaleString()}</span></div>
        <div class="flex flex-col items-center"><span class="stat-label">Volume</span><span class="stat-value">${token.volume.toLocaleString()}</span></div>
        <div class="flex flex-col items-center"><span class="stat-label">Active Miners</span><span class="stat-value">{token.activeMiners}</span></div>
        <div class="flex flex-col items-center"><span class="stat-label">Circ Supply</span><span class="stat-value">{token.circSupply.toLocaleString()}</span></div>
        <div class="flex flex-col items-center"><span class="stat-label">Total Supply</span><span class="stat-value">{token.totalSupply.toLocaleString()}</span></div>
        <div class="flex flex-col items-center"><span class="stat-label">Block Height</span><span class="stat-value">{randomInt(10000, 99999)}</span></div>
        <div class="flex flex-col items-center"><span class="stat-label">Halving</span><span class="stat-value">{randomInt(50000, 210000)}</span></div>
        <div class="flex flex-col items-center"><span class="stat-label">Reward</span><span class="stat-value">{token.reward} {token.symbol}</span></div>
      </div>
      <div class="flex-grow"></div>
      <div class="card-bottom flex flex-col items-center gap-2 mt-2">
        <button
          class="details-btn"
          on:click|stopPropagation={() => goto(`/launch/explore/${token.symbol}`)}
          aria-label={`Open details for ${token.name}`}
        >
          <span>Details</span>
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="ml-1 details-arrow">
            <path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  </Panel>
{/each}
        {/if}
      </div>

      <style>
        .token-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 0.6rem;
          width: 100%;
          margin: 0 auto;
          justify-content: center;
          align-items: stretch;
        }
        @media (max-width: 1200px) {
          .token-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 800px) {
          .token-grid {
            grid-template-columns: 1fr;
          }
        }
        .token-card-panel.compact {
          min-width: 300px;
          min-height: 210px;
          max-width: 360px;
          margin: 0;
          padding: 0.75rem 0.75rem 0.5rem 0.75rem;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        }
        .token-card-panel {
          width: 100%;
          height: 100%;
          min-height: 210px;
          background: #18181b;
          border-radius: 1.1rem;
          box-shadow: 0 2px 10px 0 #00000012;
          border: 1px solid #232526;
          display: flex;
          flex-direction: column;
          justify-content: stretch;
          transition: box-shadow 0.13s;
        }
        .token-card-panel:hover {
          box-shadow: 0 4px 24px #f9731618, 0 0 8px #f59e4240;
        }
        .token-card-clickable {
          position: relative;
          background: rgba(23,23,23,0.85);
          border-radius: 1.25rem;
          box-shadow: 0 2px 16px 0 #00000020;
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.13s cubic-bezier(.4,0,.2,1), box-shadow 0.13s cubic-bezier(.4,0,.2,1);
          border: 1.5px solid transparent;
        }
        .token-card-clickable:hover, .token-card-clickable:focus {
          transform: translateY(-4px) scale(1.045);
          border-color: #f97316;
          box-shadow: 0 8px 36px 0 #f9731630, 0 0 16px #f59e42cc, 0 0 32px #fbbf24a0;
          z-index: 2;
        }
        .token-card-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, #2dd4bf33 0%, #f59e4233 100%);
          opacity: 0.18;
          z-index: 0;
        }
        .card-accent {
          width: 100%;
          height: 4px;
          border-top-left-radius: 1rem;
          border-top-right-radius: 1rem;
          margin-bottom: 0.5rem;
        }
        .token-card-content {
          position: relative;
          z-index: 1;
          padding: 1.25rem 1.1rem 1.1rem 1.1rem;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          min-height: 410px;
          height: 100%;
        }
        .token-title {
          font-size: 1rem;
          font-weight: 700;
          line-height: 1.14;
          max-width: 200px;
          max-height: 2.2em;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: normal;
          word-break: break-word;
          margin-bottom: 0.05rem;
          letter-spacing: -0.01em;
        }
        .token-symbol {
          color: #a3a3a3;
          font-size: 1.01rem;
          font-family: 'JetBrains Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
          font-weight: 500;
          letter-spacing: 0.04em;
          margin-bottom: 0.1rem;
        }
        .token-stats {
          font-size: 0.97rem;
        }
        .stat-label {
          color: #e5e7eb;
          font-size: 0.91rem;
          font-weight: 400;
          opacity: 0.85;
        }
        .stat-value {
          font-size: 1.01rem;
          font-weight: 600;
          color: #fff;
          letter-spacing: 0.01em;
        }
        .desc {
          color: #d1d5db;
          font-size: 0.98rem;
          text-align: center;
          margin: 0.1rem 0 0.2rem 0;
          line-height: 1.22;
          font-weight: 500;
          max-width: 98%;
        }
        .card-divider {
          width: 80%;
          height: 1.5px;
          background: linear-gradient(90deg, #232526 0%, #f97316 100%);
          opacity: 0.13;
          margin: 0.7rem auto 0.8rem auto;
          border-radius: 1px;
        }
        .card-bottom {
          margin-top: auto;
        }
        /* Remove progress bar styling for compact cards */
        .details-btn {
          margin: 0.6rem auto 0 auto;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          background: linear-gradient(90deg, #f59e42 10%, #f97316 90%);
          color: white;
          font-weight: 600;
          font-size: 0.98rem;
          padding: 0.35rem 1.1rem;
          border-radius: 999px;
          border: none;
          outline: none;
          box-shadow: 0 2px 8px #f9731620;
          cursor: pointer;
          transition: background 0.2s, transform 0.13s, box-shadow 0.18s;
          position: relative;
          letter-spacing: 0.01em;
        }
        .details-btn:hover, .details-btn:focus {
          background: linear-gradient(90deg, #fbbf24 10%, #f97316 90%);
          transform: scale(1.04) translateY(-1px);
          box-shadow: 0 6px 24px #f9731630, 0 0 8px #fbbf24cc;
        }
        .details-arrow {
          transition: transform 0.22s cubic-bezier(.4,0,.2,1);
        }
        .details-btn:hover .details-arrow {
          transform: translateX(4px) scale(1.12);
        }
        .chain-tag {
          font-size: 0.93rem;
          padding: 0.13rem 0.7rem;
          border-radius: 999px;
          margin-bottom: 0.3rem;
          background: #232526;
          color: #fff;
          display: inline-block;
          box-shadow: 0 2px 8px #0002;
        }
        /* Remove old sort-bar and sort-pill styles, replaced by kong-btn-sm utility */
        .kong-btn-sm {
          padding: 0.35rem 1.1rem;
          font-size: 0.95rem;
          font-weight: 600;
          border-radius: 999px;
          outline: none;
          border: none;
          transition: background 0.18s, color 0.18s;
          display: flex;
          align-items: center;
          gap: 0.3rem;
        }
        .kong-btn-sm svg {
          margin-right: 0.3rem;
        }
        .click-hint {
          display: block;
          margin: 0.6rem auto 0 auto;
          text-align: center;
          color: #fbbf24;
          font-size: 0.92rem;
          opacity: 0.85;
          font-weight: 600;
          letter-spacing: 0.04em;
        }
        .no-tokens-found {
          grid-column: 1/-1;
          background: rgba(30, 41, 59, 0.8);
          border-radius: 1rem;
          padding: 2.5rem 1.5rem;
        }
        @media (max-width: 768px) {
          .token-grid {
            flex-direction: column;
            align-items: center;
          }
        }
        @media (min-width: 768px) and (max-width: 1024px) {
          .token-grid {
            flex-wrap: wrap;
            justify-content: center;
          }
        }
      </style>


  </div>
</div>
</div>
