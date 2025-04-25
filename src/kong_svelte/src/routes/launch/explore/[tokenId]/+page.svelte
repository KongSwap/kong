<script lang="ts">
  import { page } from "$app/stores";
  import Panel from "$lib/components/common/Panel.svelte";
  import { onMount } from "svelte";
  import { Pickaxe, Network, Rocket, Coins, Laugh, Flame, Zap } from "lucide-svelte";
  import { auth, requireWalletConnection } from "$lib/stores/auth";
  import { IcrcService } from "$lib/services/icrc/IcrcService";
  import { toastStore } from "$lib/stores/toastStore";
  import { idlFactory as launchpadIDL, canisterId as launchpadCanisterId } from "@declarations/launchpad";
  import { get } from "svelte/store";
  import { userTokens } from "$lib/stores/userTokens";

  // Dummy tokens data (match explore page)
  const demoTokens = [
    {
      symbol: "ICP",
      name: "Internet Computer Protocol",
      icon: Pickaxe,
      status: "Available",
      description: "The native token of the Internet Computer. Decentralized, unstoppable, and ready for the future of blockchain. Mine, trade, and build!",
      price: 0.00000321,
      tvl: 32000,
      volume: 17000,
      circSupply: 2100000,
      totalSupply: 10000000,
      percentMined: 21,
      reward: 123,
      activeMiners: 456,
      totalMiners: 1234,
      blocksMined: 4259,
      nextHalving: "2025-08-01",
      topHolders: [
        { principal: "12x4...nae", miners: 140, blocks: 4259 },
        { principal: "gbu3...mae", miners: 200, blocks: 2580 },
        { principal: "tslv...qge", miners: 6, blocks: 1678 },
      ],
      userMiners: 3,
      userHashrate: 0.42,
      userBlocks: 12
    },
    {
      symbol: "PEPE",
      name: "Pepe Coin (Demo)",
      icon: Laugh,
      status: "Demo",
      description: "A meme coin for testing. Not real. Mine for fun and glory. The frog is strong!",
      price: 0.00000069,
      tvl: 12000,
      volume: 4200,
      circSupply: 420690,
      totalSupply: 1000000,
      percentMined: 42,
      reward: 69,
      activeMiners: 123,
      totalMiners: 456,
      blocksMined: 1337,
      nextHalving: "2025-10-10",
      topHolders: [
        { principal: "pepe...lol", miners: 42, blocks: 900 },
        { principal: "frog...top", miners: 17, blocks: 420 },
        { principal: "meme...win", miners: 8, blocks: 17 },
      ],
      userMiners: 1,
      userHashrate: 0.07,
      userBlocks: 2
    },
    {
      symbol: "PUMP",
      name: "PumpFun (Demo)",
      icon: Flame,
      status: "Demo",
      description: "Testnet token for pump.fun style experiments. Get ready to pump!",
      price: 0.00000123,
      tvl: 8000,
      volume: 3000,
      circSupply: 500000,
      totalSupply: 2000000,
      percentMined: 25,
      reward: 150,
      activeMiners: 80,
      totalMiners: 200,
      blocksMined: 500,
      nextHalving: "2025-09-09",
      topHolders: [
        { principal: "pump...1", miners: 20, blocks: 200 },
        { principal: "pump...2", miners: 15, blocks: 150 },
      ],
      userMiners: 2,
      userHashrate: 0.12,
      userBlocks: 5
    },
    {
      symbol: "MEME",
      name: "Meme Token (Demo)",
      icon: Zap,
      status: "Demo",
      description: "Another fun demo token. Not real. Meme on!",
      price: 0.00000042,
      tvl: 5000,
      volume: 2100,
      circSupply: 210000,
      totalSupply: 420000,
      percentMined: 50,
      reward: 42,
      activeMiners: 33,
      totalMiners: 100,
      blocksMined: 123,
      nextHalving: "2025-12-12",
      topHolders: [
        { principal: "meme...1", miners: 10, blocks: 60 },
        { principal: "meme...2", miners: 5, blocks: 40 },
      ],
      userMiners: 1,
      userHashrate: 0.03,
      userBlocks: 1
    },
    {
      symbol: "SOL",
      name: "Solana",
      icon: Network,
      status: "Coming Soon",
      description: "Solana support coming soon.",
      price: 0.00000234,
      tvl: 0,
      volume: 0,
      circSupply: 0,
      totalSupply: 10000000,
      percentMined: 0,
      reward: 0,
      activeMiners: 0,
      totalMiners: 0,
      blocksMined: 0,
      nextHalving: "-",
      topHolders: [],
      userMiners: 0,
      userHashrate: 0,
      userBlocks: 0
    },
    {
      symbol: "SUI",
      name: "Sui",
      icon: Rocket,
      status: "Coming Soon",
      description: "Sui support coming soon.",
      price: 0.00000111,
      tvl: 0,
      volume: 0,
      circSupply: 0,
      totalSupply: 10000000,
      percentMined: 0,
      reward: 0,
      activeMiners: 0,
      totalMiners: 0,
      blocksMined: 0,
      nextHalving: "-",
      topHolders: [],
      userMiners: 0,
      userHashrate: 0,
      userBlocks: 0
    },
    {
      symbol: "ETH",
      name: "Ethereum",
      icon: Coins,
      status: "Coming Soon",
      description: "Ethereum support coming soon.",
      price: 0.00000456,
      tvl: 0,
      volume: 0,
      circSupply: 0,
      totalSupply: 10000000,
      percentMined: 0,
      reward: 0,
      activeMiners: 0,
      totalMiners: 0,
      blocksMined: 0,
      nextHalving: "-",
      topHolders: [],
      userMiners: 0,
      userHashrate: 0,
      userBlocks: 0
    },
    {
      symbol: "BTC",
      name: "Bitcoin",
      icon: Coins,
      status: "Coming Soon",
      description: "Bitcoin support coming soon.",
      price: 0.00000567,
      tvl: 0,
      volume: 0,
      circSupply: 0,
      totalSupply: 10000000,
      percentMined: 0,
      reward: 0,
      activeMiners: 0,
      totalMiners: 0,
      blocksMined: 0,
      nextHalving: "-",
      topHolders: [],
      userMiners: 0,
      userHashrate: 0,
      userBlocks: 0
    }
  ];

  let tokenId: string = '';
  let token: any = null;
  let deploying = false;

  $: tokenId = $page.params.tokenId;
  $: token = demoTokens.find(t => t.symbol.toLowerCase() === tokenId?.toLowerCase());

  async function deployMiner() {
    try {
      requireWalletConnection();
      deploying = true;
      const tokensList = get(userTokens.tokens);
      const kongToken = tokensList.find(t => t.symbol === "KONG");
      if (!kongToken) throw new Error("KONG token not found");
      const amount = BigInt(125) * BigInt(10 ** (kongToken.decimals || 8));
      await IcrcService.checkAndRequestIcrc2Allowances(kongToken, amount, launchpadCanisterId);
      const launchpadActor = auth.getActor(launchpadCanisterId, launchpadIDL, { requiresSigning: true });
      const { account } = get(auth);
      if (!account?.owner) throw new Error("Wallet not connected");
      const result = await launchpadActor.create_miner(account.owner, []);
      if ("Err" in result) throw new Error(result.Err);
      const minerId = result.Ok;
      toastStore.success(`Miner deployed: ${minerId.toText()}`);
    } catch (error) {
      toastStore.error(`Failed to deploy miner: ${error.message}`);
    } finally {
      deploying = false;
    }
  }
</script>

<svelte:head>
  <title>{token ? token.name : 'Token'} - Details</title>
</svelte:head>

{#if token}
  <div class="min-h-screen bg-kong-bg text-kong-text-primary px-4 py-8">
    <div class="max-w-4xl mx-auto">
  <div class="flex gap-2 justify-end mb-4">
  <a href="https://twitter.com/" target="_blank" rel="noopener" aria-label="Twitter" class="p-2 bg-kong-bg-light/50 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors rounded-md flex items-center">
    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M22.46 6c-.77.35-1.6.58-2.46.69a4.3 4.3 0 0 0 1.88-2.37c-.85.5-1.8.86-2.8 1.05A4.28 4.28 0 0 0 16.11 4c-2.36 0-4.28 1.92-4.28 4.29 0 .34.04.67.1.99-3.56-.18-6.72-1.89-8.84-4.48-.37.63-.58 1.36-.58 2.14 0 1.48.75 2.79 1.88 3.55-.7-.02-1.36-.22-1.94-.53v.05c0 2.07 1.48 3.8 3.44 4.19-.36.1-.74.16-1.13.16-.27 0-.53-.03-.78-.07.53 1.66 2.07 2.87 3.89 2.9A8.6 8.6 0 0 1 2 19.54 12.14 12.14 0 0 0 8.29 21.5c7.55 0 11.68-6.26 11.68-11.68 0-.18 0-.36-.01-.54.8-.58 1.5-1.3 2.05-2.12z"></path></svg>
  </a>
  <a href="https://t.me/" target="_blank" rel="noopener" aria-label="Telegram" class="p-2 bg-kong-bg-light/50 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors rounded-md flex items-center">
    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M21.05 3.39a2.09 2.09 0 0 0-2.19-.15L3.77 10.44c-1.07.53-1.05 1.38-.18 1.66l3.04.95 1.17 3.55c.2.62.44.77.77.77.24 0 .54-.09.85-.32l2.11-1.53 2.48 1.83c.46.34.81.16.92-.41l2.13-10.33c.19-.87-.13-1.37-.85-1.37zm-2.19 1.16l-2.13 10.34-2.48-1.83-2.11 1.53-1.17-3.55-3.04-.95 14.93-7.54z"></path></svg>
  </a>
  <button class="p-2 bg-kong-bg-light/50 text-orange-400 hover:bg-orange-500 hover:text-white transition-colors rounded-md flex items-center" aria-label="Share">
    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
  </button>
</div>
      <Panel className="p-6 mb-6 flex flex-col md:flex-row gap-6 items-start md:items-center" variant="transparent" roundness="rounded-xl">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 rounded-full flex items-center justify-center bg-kong-bg-light/30">
            <svelte:component this={token.icon} size={40} class="text-kong-primary" />
          </div>
          <div>
            <div class="text-2xl font-bold flex items-center gap-2">{token.name}
              <span class="ml-2 px-2 py-1 rounded text-xs font-medium bg-green-700 text-green-300">{token.status}</span>
            </div>
            <div class="text-kong-text-secondary text-sm font-mono">{token.symbol}</div>
          </div>
        </div>
      </Panel>
      <div class="mb-8">
  <div class="text-lg font-bold mb-2 tracking-wide">Mining Progress</div>
  <div class="w-full h-6 bg-kong-bg-light/40 rounded-md overflow-hidden relative mb-2 border border-kong-bg-light/60">
    <div class="bg-kong-primary h-full transition-all duration-700" style="width: {token.percentMined}%"></div>
    <div class="absolute inset-0 flex items-center justify-center text-sm font-bold text-white/90 drop-shadow">{token.percentMined}% mined</div>
  </div>
  <div class="flex flex-wrap gap-4 text-sm text-kong-text-secondary mt-2">
    <span>Total Supply: <span class="font-bold text-white">{token.totalSupply.toLocaleString()}</span></span>
    <span>Circulating: <span class="font-bold text-white">{token.circSupply.toLocaleString()}</span></span>
    <span>Block Reward: <span class="font-bold text-white">{token.reward} {token.symbol}</span></span>
    <span>Blocks Mined: <span class="font-bold text-white">{token.blocksMined}</span></span>
    <span>Next Halving: <span class="font-bold text-white">{token.nextHalving}</span></span>
  </div>
</div>
      <div class="grid md:grid-cols-2 gap-6">
        <Panel className="p-4" variant="transparent" roundness="rounded-xl">
  <div class="text-lg font-bold mb-3 tracking-wide">Token Stats</div>
  <div class="text-base grid grid-cols-2 gap-y-2 gap-x-4">
    <span class="text-kong-text-secondary font-medium">Price:</span> <span class="font-mono">${token.price}</span>
    <span class="text-kong-text-secondary font-medium">TVL:</span> <span class="font-mono">${token.tvl.toLocaleString()}</span>
    <span class="text-kong-text-secondary font-medium">Volume:</span> <span class="font-mono">${token.volume.toLocaleString()}</span>
    <span class="text-kong-text-secondary font-medium">Circulating Supply:</span> <span class="font-mono">{token.circSupply.toLocaleString()}</span>
    <span class="text-kong-text-secondary font-medium">Total Supply:</span> <span class="font-mono">{token.totalSupply.toLocaleString()}</span>
  </div>
</Panel>
        <Panel className="p-4" variant="transparent" roundness="rounded-xl">
  <div class="text-lg font-bold mb-3 tracking-wide">Mining Stats</div>
  <div class="text-base grid grid-cols-2 gap-y-2 gap-x-4">
    <span class="text-kong-text-secondary font-medium">Total Miners:</span> <span class="font-mono">{token.totalMiners}</span>
    <span class="text-kong-text-secondary font-medium">Active Miners:</span> <span class="font-mono">{token.activeMiners}</span>
    <span class="text-kong-text-secondary font-medium">Block Reward:</span> <span class="font-mono">{token.reward} {token.symbol}</span>
    <span class="text-kong-text-secondary font-medium">Blocks Mined:</span> <span class="font-mono">{token.blocksMined}</span>
    <span class="text-kong-text-secondary font-medium">Next Halving:</span> <span class="font-mono">{token.nextHalving}</span>
  </div>
  <div class="mt-4 flex gap-3">
    <button on:click={deployMiner} disabled={deploying} class="block w-full p-3 bg-blue-500 text-white font-medium cursor-pointer transition-colors duration-200 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed rounded-md">
      {deploying ? 'Deploying...' : '🚀 Start Mining'}
    </button>
    <button class="block w-full p-3 bg-blue-500 text-white font-medium cursor-pointer transition-colors duration-200 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed rounded-md">👷‍♂️ Your Miners ({token.userMiners})</button>
  </div>
</Panel>
      </div>
      <Panel className="p-4 mt-6" variant="transparent" roundness="rounded-xl">
  <div class="text-lg font-bold mb-3 tracking-wide">Top Holders</div>
  <div class="overflow-x-auto">
    <table class="min-w-full text-base">
      <thead>
        <tr class="text-left text-kong-text-secondary font-semibold">
          <th class="pr-6">Principal</th>
          <th class="pr-6">Miners</th>
          <th>Blocks Mined</th>
        </tr>
      </thead>
      <tbody>
        {#each token.topHolders as holder}
          <tr class="border-t border-kong-bg-light/30">
            <td class="py-1 font-mono">{holder.principal}</td>
            <td class="py-1 font-mono">{holder.miners}</td>
            <td class="py-1 font-mono">{holder.blocks}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</Panel>
      <Panel className="p-4 mt-6" variant="transparent" roundness="rounded-xl">
  <div class="text-lg font-bold mb-3 tracking-wide">About {token.symbol}</div>
  <div class="text-base text-kong-text-secondary mb-3">{token.description}</div>
  <div class="flex flex-wrap gap-4 mt-2">
    <div class="bg-kong-bg-light/30 rounded-md px-4 py-2 text-base">
      <span class="font-semibold text-white">Your Miners:</span> {token.userMiners}
    </div>
    <div class="bg-kong-bg-light/30 rounded-md px-4 py-2 text-base">
      <span class="font-semibold text-white">Your Hashrate:</span> {token.userHashrate} H/s
    </div>
    <div class="bg-kong-bg-light/30 rounded-md px-4 py-2 text-base">
      <span class="font-semibold text-white">Your Blocks:</span> {token.userBlocks}
    </div>
  </div>
</Panel>
    </div>
  </div>
{:else}
  <div class="min-h-screen flex items-center justify-center text-kong-text-secondary">Token not found.</div>
{/if}
