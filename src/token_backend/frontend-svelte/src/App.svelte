<script lang="ts">
  import { onMount } from 'svelte';
  import { createPNP, walletsList } from '@windoge98/plug-n-play';
  import { idlFactory } from '../../../../src/declarations/token_backend/token_backend.did.js';
  import { tokenStore } from './stores/tokens';
  import { tokenInfo } from './stores/token-info';
  import Header from './components/Header.svelte';
  import Footer from './components/Footer.svelte';
  import Info from './components/pages/Info.svelte';
  import Leaderboard from './components/pages/Leaderboard.svelte';
  import Wallet from './components/pages/Wallet.svelte';
  import Buy from './components/pages/Buy.svelte';
  
  // Types
  interface Wallet {
    id: string;
    name: string;
    logo?: string;
  }

  // State management
  let miningInfo: any = null;
  let currentBlock: any = null;
  let wallets: Wallet[] = [];
  let showWalletSelector = false;
  let isConnected = false;
  let statusMessage = '';
  let statusType = 'info';
  let nonceInput = '';
  let hashInput = '';
  let currentPage = 'info';

  // Actor instances
  let anonActor: any = null;
  let authActor: any = null;
  let pnp: any = null;

  // Add metrics state
  let metrics: any = null;

  // Get canister ID based on environment
  function getCanisterId(): string {
    // Try to get from window variables (in order of preference)
    if (typeof window !== 'undefined') {
      // First try the injected canister ID from our HTTP handler
      if (window.__CANISTER_ID__) {
        console.log("Using window.__CANISTER_ID__:", window.__CANISTER_ID__);
        return window.__CANISTER_ID__;
      }
      
      // Then try common alternative variable names
      if ((window as any).canisterId) {
        console.log("Using window.canisterId:", (window as any).canisterId);
        return (window as any).canisterId;
      }
      
      if ((window as any).canisterIdRoot) {
        console.log("Using window.canisterIdRoot:", (window as any).canisterIdRoot);
        return (window as any).canisterIdRoot;
      }
      
      // Add your actual canister ID here as a fallback
      // Replace this with your actual canister ID
      const fallbackCanisterId = "bkyz2-fmaaa-aaaaa-qaaaq-cai";
      console.log("Using fallback canister ID:", fallbackCanisterId);
      return fallbackCanisterId;
    }
    
    throw new Error('Canister ID not found in window variables');
  }

  // Initialize PNP
  onMount(() => {
    const initialize = async () => {
      console.log("App mounted");
      try {
        // Ensure global is defined
        if (typeof window !== 'undefined' && typeof (window as any).global === 'undefined') {
          (window as any).global = window;
        }

        // Initialize PNP with retry logic
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            pnp = createPNP({
              hostUrl: "https://icp0.io",
              isDev: false,
              identityProvider: "https://identity.ic0.app",
              derivationOrigin: window.location.origin,
              persistSession: true
            });
            
            // Test PNP initialization
            if (!pnp) {
              throw new Error('PNP initialization failed');
            }
            
            break;
          } catch (error) {
            console.error(`PNP initialization attempt ${retryCount + 1} failed:`, error);
            retryCount++;
            if (retryCount === maxRetries) {
              throw new Error('Failed to initialize wallet connection after multiple attempts');
            }
          }
        }

        // Fetch tokens only if not in dev mode
        if (!pnp.isDev) {
          await tokenStore.fetchTokens();
        }
        
        wallets = walletsList;
        await initializeApp();
        console.log("PNP initialized successfully");
      } catch (error) {
        console.error('Failed to initialize PNP:', error);
        showStatus(error instanceof Error ? error.message : 'Failed to initialize application', 'error');
      }
    };

    initialize();
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  });

  // Get anonymous actor for queries
  async function getAnonActor() {
    try {
      if (!anonActor) {
        const canisterId = getCanisterId();
        console.log("Creating anonymous actor for canister:", canisterId);
        anonActor = await pnp.getActor(canisterId, idlFactory, { anon: true });
      }
      return anonActor;
    } catch (error) {
      console.error("Failed to create anonymous actor:", error);
      throw new Error(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Get authenticated actor for updates
  async function getAuthActor() {
    try {
      if (!authActor) {
        const canisterId = getCanisterId();
        authActor = await pnp.getActor(canisterId, idlFactory);
      }
      return authActor;
    } catch (error) {
      console.error("Failed to create authenticated actor:", error);
      throw new Error(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Initialize app
  async function initializeApp() {
    try {
      console.log("Initializing app...");
      const actor = await getAnonActor();
      console.log("Got anonymous actor");

      console.log("Refreshing metrics...");
      await refreshMetrics();
      
      console.log("Setting up metrics refresh interval...");
      // Update refresh interval to once per minute (60000ms) instead of every 10 seconds
      setInterval(refreshMetrics, 60000);
      
      console.log("App initialization complete");
    } catch (error) {
      console.error('Failed to initialize app:', error);
      showStatus(error instanceof Error ? error.message : 'Failed to initialize app', 'error');
    }
  }

  // Refresh functions
  async function refreshMiningInfo() {
    try {
      const actor = await getAnonActor();
      console.log("Fetching mining info...");
      const result = await actor.get_mining_info();
      console.log("Mining info result:", result);

      if (!result) {
        console.error('Got null/undefined result from get_mining_info');
        miningInfo = null;
        return;
      }

      // Check if result is already the mining info (not wrapped in Ok/Err)
      if (typeof result === 'object') {
        // Check if the result has the expected structure
        if ('current_difficulty' in result) {
          console.log("Mining info data:", result);
          
          // Handle missing next_difficulty_adjustment field if needed
          if (!('next_difficulty_adjustment' in result) && 'next_halving_interval' in result) {
            // The backend might be using a different field name or structure
            // Create a compatible object with the fields we have
            miningInfo = {
              ...result,
              // Add any missing fields that the frontend expects
              next_difficulty_adjustment: result.next_halving_interval || BigInt(0)
            };
          } else {
            miningInfo = result;
          }
        } else if ('Ok' in result && result.Ok && typeof result.Ok === 'object' && 'current_difficulty' in result.Ok) {
          console.log("Mining info data:", result.Ok);
          
          // Handle missing next_difficulty_adjustment field if needed
          if (!('next_difficulty_adjustment' in result.Ok) && 'next_halving_interval' in result.Ok) {
            // Create a compatible object with the fields we have
            miningInfo = {
              ...result.Ok,
              // Add any missing fields that the frontend expects
              next_difficulty_adjustment: result.Ok.next_halving_interval || BigInt(0)
            };
          } else {
            miningInfo = result.Ok;
          }
        } else if ('Err' in result) {
          console.error('Failed to get mining info:', result.Err);
          miningInfo = null;
        } else {
          console.error('Unexpected mining info response format:', result);
          miningInfo = null;
        }
      } else {
        console.error('Unexpected mining info response type:', typeof result);
        miningInfo = null;
      }
    } catch (error) {
      console.error('Error in refreshMiningInfo:', error);
      miningInfo = null;
    }
  }

  async function refreshCurrentBlock() {
    try {
      const actor = await getAnonActor();
      console.log("Fetching current block...");
      const result = await actor.get_current_block();
      console.log("Current block result:", result);

      if (!result) {
        console.error('Got null/undefined result from get_current_block');
        currentBlock = null;
        return;
      }

      // Check if result is an array (direct response)
      if (Array.isArray(result) && result.length === 0) {
        console.log("No blocks available yet");
        currentBlock = null;
        return;
      }

      if ('Ok' in result) {
        console.log("Block data:", result.Ok);
        currentBlock = result.Ok;
      } else if ('Err' in result) {
        console.error('Failed to get current block:', result.Err);
        currentBlock = null;
      } else {
        console.error('Unexpected response format:', result);
        currentBlock = null;
      }
    } catch (error) {
      console.error('Error in refreshCurrentBlock:', error);
      currentBlock = null;
    }
  }

  // Add metrics refresh function
  async function refreshMetrics() {
    try {
      const actor = await getAnonActor();
      console.log("Fetching metrics...");
      const result = await actor.get_metrics();
      console.log("Metrics result:", result);

      if ('Ok' in result) {
        metrics = result.Ok;
      } else if ('Err' in result) {
        console.error('Failed to get metrics:', result.Err);
        metrics = null;
      }
    } catch (error) {
      console.error('Error in refreshMetrics:', error);
      metrics = null;
    }
  }

  // Wallet connection
  async function connectWallet(walletId: string) {
    try {
      await pnp.connect(walletId);
      isConnected = true;
      showWalletSelector = false;
      authActor = null; // Reset actor cache
      showStatus('Connected successfully!', 'success');
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      showStatus(error instanceof Error ? error.message : 'Failed to connect wallet', 'error');
    }
  }

  async function disconnectWallet() {
    try {
      await pnp.disconnect();
      isConnected = false;
      authActor = null;
      showStatus('Disconnected successfully!', 'info');
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
      showStatus(error instanceof Error ? error.message : 'Failed to disconnect', 'error');
    }
  }

  // Mining actions
  async function handleGenerateBlock() {
    try {
      const actor = await getAuthActor();
      const result = await actor.generate_new_block();
      if ('Ok' in result) {
        currentBlock = result.Ok;
        await refreshMiningInfo();
        showStatus('New block generated successfully!', 'success');
      } else {
        throw new Error(result.Err);
      }
    } catch (error) {
      showStatus(error instanceof Error ? error.message : 'Failed to generate block', 'error');
    }
  }

  async function handleSubmitSolution() {
    try {
      if (!nonceInput || !hashInput) {
        throw new Error('Please fill in both nonce and hash values');
      }
      
      if (hashInput.length !== 64 || !/^[0-9a-fA-F]+$/.test(hashInput)) {
        throw new Error('Hash must be 64 hexadecimal characters');
      }

      const nonce = BigInt(nonceInput);
      const hashHex = hashInput;
      const hashBytes = new Uint8Array(32);
      
      for (let i = 0; i < 32; i++) {
        hashBytes[i] = parseInt(hashHex.substr(i * 2, 2), 16);
      }

      const actor = await getAuthActor();
      const principal = await actor.whoami();
      const result = await actor.submit_solution(principal, nonce, Array.from(hashBytes));
      
      if ('Ok' in result) {
        showStatus('Solution accepted! Block mined successfully!', 'success');
        nonceInput = '';
        hashInput = '';
        await refreshMiningInfo();
        await refreshCurrentBlock();
      } else {
        showStatus('Solution rejected - ' + result.Err, 'error');
      }
    } catch (error) {
      showStatus(error instanceof Error ? error.message : 'Failed to submit solution', 'error');
    }
  }

  function showStatus(message: string, type: string = 'info') {
    statusMessage = message;
    statusType = type;
    setTimeout(() => {
      statusMessage = '';
    }, 5000);
  }

  // Format helpers
  function formatNumber(n: number): string {
    return new Intl.NumberFormat().format(n);
  }

  function formatDate(timestamp: bigint): string {
    return new Date(Number(timestamp) * 1000).toLocaleString();
  }

  // Handle page navigation
  function handleHashChange() {
    const hash = window.location.hash.slice(1) || 'info';
    console.log("Hash changed to:", hash);
    const protectedPages = ['wallet', 'buy'];
    
    if (!isConnected && protectedPages.includes(hash)) {
      console.log("Redirecting to info due to lack of connection");
      window.location.hash = 'info';
      return;
    }
    currentPage = hash;
  }

  // Handle login success
  function handleLoginSuccess() {
    console.log("Login successful");
    isConnected = true;
    window.location.hash = 'wallet';
  }

  // Handle disconnect
  function handleDisconnect() {
    console.log("Disconnecting");
    isConnected = false;
    window.location.hash = 'info';
  }
</script>

<div class="min-h-screen bg-[#0a0a0a] text-gray-100">
  <Header 
    {isConnected} 
    {currentPage} 
    onDisconnect={handleDisconnect} 
    onLoginSuccess={handleLoginSuccess}
    {pnp}
  />
  
  <main class="container mx-auto px-4 py-16 min-h-[calc(100vh-120px)]">
    {#if currentPage === 'info'}
      <Info {isConnected} {metrics} {pnp} />
    {:else if currentPage === 'leaderboard'}
      <Leaderboard />
    {:else if currentPage === 'buy'}
      <Buy />
    {:else if currentPage === 'wallet'}
      <Wallet />
    {:else}
      <div class="max-w-lg mx-auto mt-8 p-6 bg-[#141414] rounded-lg border border-gray-800">
        <h2 class="text-xl font-semibold text-[#4a9e6e] mb-4">Login Required</h2>
        <p class="text-gray-400">Please connect your wallet to access this feature.</p>
      </div>
    {/if}
  </main>

  <Footer />
</div>

<style>
  /* Only keep essential global styles */
  :global(:root) {
    --primary-green: #1a472a;
    --secondary-green: #2d5a40;
    --text-green: #4a9e6e;
    --success-color: #4a9e6e;
    --error-color: #e74c3c;
    --warning-color: #f39c12;
    --info-color: #3498db;
  }

  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6;
    margin: 0;
    padding: 0;
  }
</style>
