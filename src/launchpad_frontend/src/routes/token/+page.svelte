<!-- src/launchpad_frontend/src/routes/token/+page.svelte -->

<script lang="ts">
  import { onMount } from "svelte";
  import { isConnected, backendActor } from '$lib/stores/wallet';
  import { auth, getKongActor, getSubAccountBalance, type KongLedgerActor } from '$lib/services/auth';
  import { canisterIds } from '$lib/constants';
  import { Principal } from '@dfinity/principal';
  import { get } from 'svelte/store';
  import { AccountIdentifier } from '@dfinity/ledger-icp';
  import { LAUNCHPAD_BACKEND_CANISTER_ID } from '$lib/services/auth';

  // Add ICRC1 transfer result type definitions
  type TransferError = {
    TxTooOld: { allowed_window_nanos: bigint };
  } | {
    BadFee: { expected_fee: bigint };
  } | {
    BadBurn: { min_burn_amount: bigint };
  } | {
    InsufficientFunds: { balance: bigint };
  } | {
    TxDuplicate: { duplicate_of: bigint };
  } | {
    TxCreatedInFuture: null;
  } | {
    TemporarilyUnavailable: null;
  };

  type TransferResult = { Ok: bigint } | { Err: TransferError };

  let currentStep = 0;
  let tokenName = "";
  let tokenTicker = "";
  let totalSupply = "";
  let selectedSubnet = "";
  let isLaunching = false;
  let launchStatus = "";
  let inputError = "";
  let selectedChain = "icp";
  let isProcessingTransfer = false;
  let deploymentProgress = 0;
  // Define types for deployment steps
type DeploymentStatus = 'pending' | 'processing' | 'completed' | 'error';

interface DeploymentStep {
  step: number;
  name: string;
  status: DeploymentStatus;
  details: string;
}

let deploymentSteps: DeploymentStep[] = [
  { step: 1, name: 'Checking Balance', status: 'pending', details: '' },
  { step: 2, name: 'Approving KONG', status: 'pending', details: '' },
  { step: 3, name: 'Creating Token', status: 'pending', details: '' },
  { step: 4, name: 'Initializing', status: 'pending', details: '' },
  { step: 5, name: 'Finalizing', status: 'pending', details: '' }
];

  const KONG_PRICE = 300; // Updated: Price in KONG tokens
  const E8S_PER_ICP = 100000000n; // 1 ICP = 100000000 e8s

  // Add KONG ledger actor with type
  let kongLedgerActor: KongLedgerActor | null = null;
  let cachedKongFee: bigint | undefined;

  const chains = [
    { 
      id: 'icp', 
      name: 'Internet Computer', 
      status: 'active',
      icon: '◉'
    },
    { 
      id: 'solana', 
      name: 'Solana', 
      status: 'coming_soon',
      eta: 'Q1 2024',
      progress: 80,
      icon: '◎'
    },
    { 
      id: 'eth', 
      name: 'Ethereum', 
      status: 'coming_soon',
      eta: 'Q2 2024',
      progress: 60,
      icon: '⟠'
    },
    { 
      id: 'bnb', 
      name: 'BNB Chain', 
      status: 'planned',
      icon: '⛓️'
    },
    { 
      id: 'btc', 
      name: 'Bitcoin', 
      status: 'planned',
      icon: '₿'
    },
    { 
      id: 'arbitrum', 
      name: 'Arbitrum', 
      status: 'planned',
      icon: '⚡'
    },
    { 
      id: 'optimism', 
      name: 'Optimism', 
      status: 'planned',
      icon: '⚡'
    },
    { 
      id: 'polygon', 
      name: 'Polygon', 
      status: 'planned',
      icon: '⬡'
    },
    { 
      id: 'avalanche', 
      name: 'Avalanche', 
      status: 'planned',
      icon: '△'
    }
  ];

  const subnets = [
    {
      id: "4ecnw-byqwz-dtgss-ua2mh-pfvs7-c3lct-gtf4e-hnu75-j7eek-iifqm-sqe",
      name: "Application Subnet 1",
      description: "General purpose application subnet"
    },
    {
      id: "4zbus-z2bmt-ilreg-xakz4-6tyre-hsqj4-slb4g-zjwqo-snjcc-iqphi-3qe",
      name: "Application Subnet 2",
      description: "High-performance application subnet"
    },
    {
      id: "5kdm2-62fc6-fwnja-hutkz-ycsnm-4z33i-woh43-4cenu-ev7mi-gii6t-4ae",
      name: "Application Subnet 3",
      description: "Scalable application subnet"
    },
  ];

  const steps = [
    { title: 'START' },
    { title: 'CHAIN' },
    { title: 'SUBNET' },
    { title: 'NAME' },
    { title: 'TICKER' },
    { title: 'SUPPLY' },
    { title: 'CONFIRM' }
  ];

  const nameExamples = [
    "MyDogCoin",
    "GrandmasKitchenToken", 
    "CoffeeClubCoin",
    "LocalBakeryToken"
  ];

  const tickerExamples = [
    "DOG",
    "GRMA",
    "COFF",
    "BAKE"
  ];

  let subaccountBalance: bigint | null = null;
  let kongBalance: bigint | null = null;
  
  // Update actor initialization function
  async function initializeKongActor() {
    if (!kongLedgerActor && $auth.account?.owner) {
      try {
        // Initialize with requiresSigning true since this is for transactions
        kongLedgerActor = await getKongActor({ requiresSigning: true });
        console.log('KONG ledger actor initialized successfully');
      } catch (error) {
        console.error('Failed to initialize KONG ledger actor:', error);
        throw new Error('Failed to initialize KONG ledger. Please try reconnecting your wallet.');
      }
    }
  }

  // Update onMount to use the new approach
  onMount(() => {
    const init = async () => {
      try {
        // Try to initialize KONG actor if user is connected
        if ($auth.account?.owner) {
          await initializeKongActor();
        }
      } catch (error) {
        console.error('Error in onMount:', error);
      }

      await updateBalances();
      const interval = setInterval(updateBalances, 5000);
      
      return () => {
        clearInterval(interval);
      };
    };

    init();
  });

  // Update updateBalances to handle bigint values
  async function updateBalances() {
    if ($auth.account?.owner) {
      try {
        // Update ICP balance (already bigint)
        subaccountBalance = await getSubAccountBalance($auth.account.owner);
        
        // Update KONG balance using anonymous actor for read-only operation
        const anonymousActor = await getKongActor({ anonymous: true });
        kongBalance = await anonymousActor.icrc1_balance_of({
          owner: $auth.account.owner,
          subaccount: []
        });
      } catch (error) {
        console.error('Error fetching balances:', error);
      }
    }
  }

  // Cache fee on component mount
  onMount(async () => {
    try {
      const anonActor = await getKongActor({ anonymous: true });
      cachedKongFee = await anonActor.icrc1_fee();
    } catch (error) {
      console.error('Error caching KONG fee:', error);
    }
  });

  // Add function to check current allowance
  async function getCurrentAllowance(spender: Principal): Promise<bigint> {
    try {
      const owner = get(auth).account?.owner;
      if (!owner) return 0n;
      
      // Use anonymous actor for allowance check
      const anonActor = await getKongActor({ anonymous: true });
      const allowance = await anonActor.icrc2_allowance({
        account: { owner, subaccount: [] },
        spender: { owner: spender, subaccount: [] }
      });
      return allowance.allowance;
    } catch (error) {
      console.error('Error checking allowance:', error);
      return 0n;
    }
  }

  // Update approveWithRetry to handle types correctly
  async function approveWithRetry(spenderPrincipal: Principal, amount: bigint, fee: bigint) {
    const maxRetries = 3;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        // Initialize actor if not already initialized
        if (!kongLedgerActor) {
          await initializeKongActor();
        }

        if (!kongLedgerActor) {
          throw new Error('KONG ledger not initialized');
        }

        // Check current allowance using anonymous actor
        const currentAllowance = await getCurrentAllowance(spenderPrincipal);

        // Calculate expiry time (e.g., 1 hour from now)
        const expiryNanos = BigInt(Date.now()) * BigInt(1_000_000) + BigInt(3600_000_000_000);

        // Approve new amount using authenticated actor
        const approveResult = await kongLedgerActor.icrc2_approve({
          spender: {
            owner: spenderPrincipal,
            subaccount: []
          },
          amount,
          expected_allowance: [currentAllowance],
          expires_at: [expiryNanos],
          fee: [fee],
          memo: [],
          from_subaccount: [],
          created_at_time: []
        });

        if ('Ok' in approveResult) {
          console.log('KONG approval successful');
          return;
        } else {
          console.error('KONG approval failed:', approveResult.Err);
          throw new Error(`KONG approval failed: ${JSON.stringify(approveResult.Err)}`);
        }
      } catch (error) {
        console.error(`KONG approval attempt ${retries + 1} failed:`, error);
        retries++;
        if (retries === maxRetries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  // Update approveKongSpending to use the retry function
  async function approveKongSpending() {
    try {
      updateDeploymentStatus(2, 'processing');
      launchStatus = "Approving KONG spending...";

      // Initialize actor if not already initialized
      if (!kongLedgerActor) {
        await initializeKongActor();
      }

      if (!kongLedgerActor) {
        throw new Error('KONG ledger not initialized. Please connect your wallet and try again.');
      }

      const principal = get(auth).account?.owner;
      if (!principal || principal.isAnonymous()) {
        throw new Error('Cannot approve with anonymous identity');
      }

      const spenderPrincipal = Principal.fromText(canisterIds.launchpad_backend.ic);
      const amount = BigInt(KONG_PRICE * 1e8); // Convert to e8s
      const fee = cachedKongFee || BigInt(10000); // Use cached fee or fallback
      const totalAmount = (amount + fee) * 10n;

      await approveWithRetry(spenderPrincipal, totalAmount, fee);
      updateDeploymentStatus(2, 'completed');
      
    } catch (error) {
      console.error('KONG approval failed:', error);
      updateDeploymentStatus(2, 'error');
      throw error;
    }
  }

  // Remove processICPTransfer function and update launchToken
  async function launchToken() {
    if (!$backendActor) {
      console.error('No backend actor available');
      launchStatus = "No backend connection. Please connect your wallet first.";
      return;
    }

    try {
      isLaunching = true;
      deploymentProgress = 0;
      deploymentSteps = deploymentSteps.map(s => ({ ...s, status: 'pending' }));
      
      // Step 1: Check Balance
      updateDeploymentStatus(1, 'processing');
      const kongRequired = BigInt(KONG_PRICE * 1e8);
      if (kongBalance === null || kongBalance < kongRequired) {
        throw new Error(`Insufficient KONG balance. Required: ${KONG_PRICE} KONG`);
      }
      updateDeploymentStatus(1, 'completed');

      // Step 2: Approve KONG spending
      updateDeploymentStatus(2, 'processing');
      await approveKongSpending();
      updateDeploymentStatus(2, 'completed');
      
      // Step 3: Create Token
      updateDeploymentStatus(3, 'processing');
      launchStatus = "Creating token...";

      const cleanTicker = tokenTicker.replace('$', '').trim().toUpperCase();
      const supply = BigInt(Number(totalSupply) * 1e8);
      
      // Validate parameters
      if (!tokenName.trim()) throw new Error('Token name is required');
      if (!cleanTicker) throw new Error('Token ticker is required');
      if (supply <= 0n) throw new Error('Supply must be greater than 0');

      const createTokenParams = {
        name: tokenName.trim(),
        ticker: cleanTicker,
        supply,
        subnet: selectedSubnet ? [Principal.fromText(selectedSubnet)] : []
      };

      // Create token
      const response = await $backendActor.create_token(
        createTokenParams.name,
        createTokenParams.ticker,
        createTokenParams.supply,
        createTokenParams.subnet
      );

      if ('Ok' in response) {
        const canisterId = response.Ok;
        updateDeploymentStatus(3, 'completed');
        
        // Step 4: Initialize
        updateDeploymentStatus(4, 'processing');
        await new Promise(resolve => setTimeout(resolve, 1000));
        updateDeploymentStatus(4, 'completed');
        
        // Step 5: Finalize
        updateDeploymentStatus(5, 'processing');
        await new Promise(resolve => setTimeout(resolve, 500));
        updateDeploymentStatus(5, 'completed');
        
        launchStatus = `Successfully deployed token! Canister ID: ${canisterId.toString()}`;
        resetForm();
      } else if ('Err' in response) {
        handleError(`Token creation failed: ${response.Err}`, 3);
      } else {
        handleError('Unexpected response format from backend', 3);
      }
    } catch (error: any) {
      handleError(error.message || 'Unknown error occurred');
    } finally {
      // Only reset isLaunching if there was no error
      if (!launchStatus.includes('Error')) {
        isLaunching = false;
      }
    }
  }

  function handleError(message: string, step: number = 0) {
    console.error('Token launch error:', message);
    if (step > 0) updateDeploymentStatus(step, 'error');
    launchStatus = `Error: ${message}`;
  }

  function resetForm() {
    currentStep = 0;
    tokenName = "";
    tokenTicker = "";
    totalSupply = "";
    selectedSubnet = "";
  }

  // Add KONG ledger types
  type Account = {
    owner: Principal;
    subaccount: [] | [Uint8Array];
  };

  type ApproveArgs = {
    spender: Account;
    amount: bigint;
    expires_at: [] | [bigint];
    fee: [] | [bigint];
    memo: [] | [Uint8Array];
    from_subaccount: [] | [Uint8Array];
    created_at_time: [] | [bigint];
  };

  type ApproveResult = {
    Ok: bigint;
    Err: any;
  };

  let isSwapping = false;
  let swapStatus = "";
  let swapError = "";
  
  // Update handleSwap to use the retry function
  async function handleSwap(event: MouseEvent) {
    console.log('Starting handleSwap function...');
    try {
      if (!$backendActor) {
        console.error('No backend actor available');
        swapError = "Please connect your wallet first";
        return;
      }
      console.log('Backend actor available:', $backendActor);

      // Initialize actor if not already initialized
      if (!kongLedgerActor) {
        console.log('Initializing KONG ledger actor...');
        await initializeKongActor();
      }

      if (!kongLedgerActor) {
        throw new Error('KONG ledger not initialized. Please connect your wallet and try again.');
      }
      console.log('KONG ledger actor initialized');

      isSwapping = true;
      swapError = "";
      swapStatus = "Approving KONG...";

      const spenderPrincipal = Principal.fromText(canisterIds.launchpad_backend.ic);
      console.log('Spender Principal:', spenderPrincipal.toString());
      
      const amount = BigInt(50 * 1e8); // 500 KONG
      const fee = cachedKongFee || BigInt(10000);
      const totalAmount = (amount + fee) * 10n;
      console.log('Swap parameters:', {
        amount: amount.toString(),
        fee: fee.toString(),
        totalAmount: totalAmount.toString()
      });

      // Get current allowance synchronously in the click handler
      const currentAllowance = await getCurrentAllowance(spenderPrincipal);
      const expiryNanos = BigInt(Date.now()) * BigInt(1_000_000) + BigInt(3600_000_000_000);

      // Do the approval synchronously in the click handler
      const approveResult = await kongLedgerActor.icrc2_approve({
        spender: {
          owner: spenderPrincipal,
          subaccount: []
        },
        amount: totalAmount,
        expected_allowance: [currentAllowance],
        expires_at: [expiryNanos],
        fee: [fee],
        memo: [],
        from_subaccount: [],
        created_at_time: []
      });

      if (!('Ok' in approveResult)) {
        console.error('KONG approval failed:', approveResult.Err);
        throw new Error(`KONG approval failed: ${JSON.stringify(approveResult.Err)}`);
      }

      // Wait for allowance to be set
      console.log('Waiting for approval to finalize...');
      let retries = 0;
      const maxRetries = 10;
      while (retries < maxRetries) {
        const newAllowance = await getCurrentAllowance(spenderPrincipal);
        console.log('Current allowance:', newAllowance.toString());
        if (newAllowance >= totalAmount) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        retries++;
      }

      if (retries === maxRetries) {
        throw new Error('Approval did not finalize in time. Please try again.');
      }

      console.log('KONG spending approved');
      swapStatus = "Swapping KONG to ICP...";
      
      if (!$auth.account?.owner) {
        throw new Error('Wallet not connected');
      }
      console.log('User Principal:', $auth.account.owner.toString());

      // Now that approval is done, we can do the swap
      const response = await $backendActor.swap_kong_to_icp(
        amount,
        [], // opt nat64 (empty array for None)
        Some(20.0), // Add 20% max slippage
        $auth.account.owner // Pass the Principal directly
      );
      console.log('Raw response from swap_kong_to_icp:', response);

      // Handle the variant type response directly
      if ('Ok' in response) {
        console.log('Swap successful, received:', response.Ok.toString());
        swapStatus = "Swap successful!";
        await updateBalances();
      } else if ('Err' in response) {
        console.error('Swap failed with error:', response.Err);
        throw new Error(`Swap failed: ${response.Err}`);
      } else {
        console.error('Unexpected response format:', response);
        throw new Error('Unexpected response format from backend');
      }
    } catch (error) {
      console.error('Swap error:', error);
      console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      swapError = error instanceof Error ? error.message : 'Failed to swap KONG to ICP';
      swapStatus = "";
    } finally {
      isSwapping = false;
    }
  }

  function startProcess() {
    currentStep = 1;
  }

  function nextStep() {
    if (validateCurrentStep() && currentStep < steps.length - 1) {
      currentStep++;
      inputError = ""; // Clear error when moving forward
    }
  }

  function prevStep() {
    if (currentStep > 0) {
      currentStep--;
    }
  }

  function validateCurrentStep(): boolean {
    inputError = ""; // Reset error message
    
    switch (currentStep) {
      case 1:
        if (!selectedChain) {
          inputError = "Please select a blockchain network";
          return false;
        }
        if (selectedChain === 'solana') {
          inputError = "Solana integration coming in Q1 2024";
          return false;
        }
        if (selectedChain === 'eth') {
          inputError = "Ethereum integration coming in Q2 2024";
          return false;
        }
        if (selectedChain !== 'icp') {
          inputError = "Only Internet Computer is available at the moment";
          return false;
        }
        return true;

      case 2:
        if (!selectedSubnet) {
          inputError = "Please select a subnet";
          return false;
        }
        return true;

      case 3:
        if (!tokenName.trim()) {
          inputError = "Please enter a token name";
          return false;
        }
        return true;
      
      case 4:
        const cleanTicker = tokenTicker.replace('$', '').trim().toUpperCase();
        if (!cleanTicker) {
          inputError = "Please enter a token ticker";
          return false;
        }
        if (cleanTicker.length < 2 || cleanTicker.length > 5) {
          inputError = "Ticker must be 2-5 characters";
          return false;
        }
        return true;
      
      case 5:
        const supply = Number(totalSupply);
        if (!totalSupply || isNaN(supply)) {
          inputError = "Please enter a valid number";
          return false;
        }
        if (supply <= 0) {
          inputError = "Total supply must be greater than 0";
          return false;
        }
        return true;
      
      default:
        return true;
    }
  }

  function updateDeploymentStatus(step: number, status: 'pending' | 'processing' | 'completed' | 'error') {
    deploymentSteps = deploymentSteps.map(s => ({
      ...s,
      status: s.step < step ? 'completed' : 
             s.step === step ? status : 
             'pending'
    }));
    deploymentProgress = (step - 1) * 20 + (status === 'completed' ? 20 : status === 'processing' ? 10 : 0);
  }

  // Helper function to safely stringify BigInt values
  function safeStringify(obj: any): string {
    return JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
  }

  // Test functions for development
  async function testSwap() {
    try {
      if (!$auth.account?.owner) {
        throw new Error('Wallet not connected');
      }

      // Pre-fill test values
      const amount = BigInt(500_0000_0000); // 500 KONG
      const fee = BigInt(10_000);

      // Get Kong actor and approve spending
      const kongActor = await getKongActor();
      const approveResult = await kongActor.icrc2_approve({
        amount,
        spender: { owner: Principal.fromText(LAUNCHPAD_BACKEND_CANISTER_ID), subaccount: [] },
        fee: [fee],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
        expected_allowance: [], // Optional
        expires_at: [] // Optional
      });

      if (!('Ok' in approveResult)) {
        throw new Error(`KONG approval failed: ${JSON.stringify(approveResult.Err)}`);
      }

      // Execute swap
      const response = await $backendActor.swap_kong_to_icp(
        Number(amount),
        [], // opt nat64 (empty array for None)
        $auth.account.owner
      );

      if ('Ok' in response) {
        console.log('Test swap successful:', response.Ok.toString());
        alert('Test swap successful!');
      } else {
        throw new Error(`Swap failed: ${response.Err}`);
      }
    } catch (error: unknown) {
      console.error('Test swap error:', error);
      alert(`Test swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async function testDeploy() {
    try {
      // Pre-fill test values
      tokenName = "Test Token";
      tokenTicker = "TEST";
      totalSupply = "1000000";
      selectedSubnet = "icp";

      // Start deployment process
      await launchToken();
    } catch (error: unknown) {
      console.error('Test deploy error:', error);
      alert(`Test deploy failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
</script>

<div class="h-[calc(100dvh-104px)] flex flex-col">
  {#if !$isConnected}
    <div class="flex items-center justify-center h-full">
      <div class="relative w-full max-w-2xl border-2 border-cyan-500 bg-black/90">
        <!-- Cyber grid background -->
        <div class="absolute inset-0 bg-grid-pattern opacity-10"></div>
        
        <!-- Content -->
        <div class="relative flex flex-col items-center justify-center h-full p-8 space-y-6">
          <div class="text-4xl font-bold text-white">ACCESS REQUIRED</div>
          <div class="text-xl text-cyan-400">Connect your wallet to create tokens</div>
          <div class="p-4 mx-auto text-lg border w-fit border-cyan-500/30 bg-cyan-950/50">
            <span class="text-white">Required: </span>
            <span class="font-bold text-cyan-400">{KONG_PRICE} $KONG</span>
          </div>
          <div class="text-sm text-cyan-400/70">
            Initialize secure connection to proceed with token deployment
          </div>
        </div>
      </div>
    </div>
  {:else}
    <!-- Step Indicator -->
    <div class="flex-none w-full min-h-[72px] border-b border-cyan-500/30 bg-black/90">
      <div class="relative h-full p-2 md:p-4">
        <!-- Step Markers -->
        <div class="relative flex justify-between w-full h-full pt-2 overflow-x-auto overflow-y-hidden custom-scrollbar">
          <div class="flex justify-between min-w-full gap-1 px-1 md:gap-2 md:px-2">
            {#each steps as step, index}
              <div class="flex flex-col items-center justify-start flex-1 min-w-[50px] md:min-w-[80px]">
                <div 
                  class={`w-2 h-2 md:w-3 md:h-3 mb-1 md:mb-2 transition-all duration-300 border-2 rounded-full
                    ${currentStep >= index ? 
                      'bg-cyan-400 border-cyan-400' : 
                      'bg-black border-gray-600'}`}
                ></div>
                <div 
                  class={`text-[10px] md:text-xs font-bold transition-all duration-300 whitespace-nowrap text-center
                    ${currentStep >= index ? 'text-cyan-400' : 'text-gray-600'}`}
                >
                  {step.title}
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <!-- Content Area -->
    <div class="flex-1 overflow-hidden">
      <div class="relative flex flex-col h-full border-l border-r border-cyan-500/30 bg-black/90">
        <!-- Content Container -->
        <div class="flex-1 h-full overflow-y-auto custom-scrollbar">
          <div class="flex flex-col items-center justify-center min-h-full p-4 md:p-8">
            <!-- Step Content -->
            {#if currentStep === 0}
              <!-- Start Screen -->
              <div class="w-full max-w-xl space-y-6 text-center">
                <h2 class="text-3xl font-bold text-white">CREATE YOUR TOKEN</h2>
                <p class="text-lg text-cyan-400">Launch your own token on multiple blockchains</p>
                <div class="inline-block p-3 mt-2 text-lg bg-cyan-950">
                  <span class="text-white">Cost: </span>
                  <span class="font-bold text-cyan-400">{KONG_PRICE} $KONG</span>
                </div>
                <button 
                  on:click={startProcess}
                  class="block w-48 px-6 py-4 mx-auto text-xl font-bold text-white transition-all duration-300 border hover:bg-cyan-500/20 border-cyan-400"
                >
                  START →
                </button>

                <!-- Add test button -->
                <button
                  on:click={() => {
                    tokenName = "KongPad";
                    tokenTicker = "$PAD";
                    selectedSubnet = subnets[0].id;
                    currentStep = 1;
                  }}
                  class="block w-48 px-6 py-4 mx-auto mt-4 text-xl font-bold text-white transition-all duration-300 border hover:bg-cyan-500/20 border-cyan-400"
                >
                  TEST →
                </button>
              </div>
            {:else if currentStep === 1}
              <!-- Chain Selection -->
              <div class="w-full max-w-4xl space-y-8 text-center">
                <h3 class="text-3xl font-bold text-white">Choose Your Blockchain</h3>
                <p class="text-lg text-cyan-400">Select the network for your token deployment</p>

                <!-- Active & Coming Soon Chains -->
                <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <!-- Internet Computer -->
                  <button
                    class={`group relative transition-all duration-300 cursor-pointer bg-black border-2 
                      ${selectedChain === 'icp' ? 
                        'border-cyan-400 bg-cyan-500/10' : 
                        'border-cyan-500/50 hover:border-cyan-400 hover:bg-cyan-500/5'}`}
                    on:click={() => selectedChain = 'icp'}
                  >
                    <div class="p-6 space-y-4">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                          {#if selectedChain === 'icp'}
                            <div class="relative flex items-center justify-center w-6 h-6">
                              <div class="absolute w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
                              <div class="absolute w-3 h-3 bg-green-400 rounded-full"></div>
                            </div>
                          {:else}
                            <span class="text-2xl">◉</span>
                          {/if}
                          <span class="text-lg font-bold text-white">Internet Computer</span>
                        </div>
                        <span class="px-3 py-1 text-xs font-bold text-green-400 border border-green-500/30 bg-green-900/30">
                          LIVE
                        </span>
                      </div>
                      <div class="text-sm text-cyan-400/70">
                        Standards: ICRC-1, ICRC-2, ICRC-3
                      </div>
                    </div>
                  </button>

                  <!-- Solana -->
                  <button 
                    class={`group relative bg-black border-2 
                      ${selectedChain === 'solana' ? 
                        'border-yellow-400 bg-yellow-500/10' : 
                        'border-yellow-500/50 hover:border-yellow-400 hover:bg-yellow-500/5'}`}
                    on:click={() => selectedChain = 'solana'}
                  >
                    <div class="p-6 space-y-4">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                          {#if selectedChain === 'solana'}
                            <div class="relative flex items-center justify-center w-6 h-6">
                              <div class="absolute w-3 h-3 bg-yellow-400 rounded-full animate-ping"></div>
                              <div class="absolute w-3 h-3 bg-yellow-400 rounded-full"></div>
                            </div>
                          {:else}
                            <span class="text-2xl">◎</span>
                          {/if}
                          <span class="text-lg font-bold text-white">Solana</span>
                        </div>
                        <span class="px-3 py-1 text-xs font-bold text-yellow-400 border border-yellow-500/30 bg-yellow-900/30">
                          Q1 2024
                        </span>
                      </div>
                      <div class="text-sm text-yellow-400/70">
                        Standards: SPL Token
                      </div>
                    </div>
                  </button>

                  <!-- Ethereum -->
                  <button 
                    class={`group relative bg-black border-2 
                      ${selectedChain === 'eth' ? 
                        'border-yellow-400 bg-yellow-500/10' : 
                        'border-yellow-500/50 hover:border-yellow-400 hover:bg-yellow-500/5'}`}
                    on:click={() => selectedChain = 'eth'}
                  >
                    <div class="p-6 space-y-4">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                          {#if selectedChain === 'eth'}
                            <div class="relative flex items-center justify-center w-6 h-6">
                              <div class="absolute w-3 h-3 bg-yellow-400 rounded-full animate-ping"></div>
                              <div class="absolute w-3 h-3 bg-yellow-400 rounded-full"></div>
                            </div>
                          {:else}
                            <span class="text-2xl">⟠</span>
                          {/if}
                          <span class="text-lg font-bold text-white">Ethereum</span>
                        </div>
                        <span class="px-3 py-1 text-xs font-bold text-yellow-400 border border-yellow-500/30 bg-yellow-900/30">
                          Q2 2024
                        </span>
                      </div>
                      <div class="text-sm text-yellow-400/70">
                        Standards: ERC-20, ERC-721
                      </div>
                    </div>
                  </button>
                </div>

                <!-- Planned Integrations -->
                <div class="space-y-4">
                  <h4 class="text-xl font-bold text-white">Planned Integrations</h4>
                  <div class="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
                    {#each chains.filter(c => c.status === 'planned') as chain}
                      <div class="relative transition-colors border border-gray-800 bg-black/40 hover:border-gray-700">
                        <div class="p-4">
                          <div class="flex items-center justify-center space-x-2">
                            <span class="text-xl text-gray-500">{chain.icon}</span>
                            <span class="text-sm text-gray-400">{chain.name}</span>
                          </div>
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>

                <!-- Info Box -->
                <div class="p-4 border bg-black/40 border-cyan-500/20">
                  <div class="flex items-center space-x-3">
                    <span class="text-cyan-400">💡</span>
                    <p class="text-sm text-cyan-400/80">
                      Powered by Internet Computer's Chain Fusion technology, enabling true cross-chain integration through chain-key cryptography and threshold signatures.
                    </p>
                  </div>
                </div>
              </div>
            {:else if currentStep === 2}
              <!-- Subnet Selection -->
              <div class="w-full max-w-2xl space-y-4">
                <h3 class="text-3xl font-bold text-white">Choose Your Subnet</h3>
                <p class="text-lg text-cyan-400">Select the subnet for your token deployment</p>
                
                <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {#each subnets as subnet}
                    <button
                      class="p-4 border-2 transition-all duration-300 text-left ${selectedSubnet === subnet.id ? 
                        'border-cyan-400 bg-cyan-500/20' : 
                        'border-cyan-500/30 hover:bg-cyan-500/10'}"
                      on:click={() => selectedSubnet = subnet.id}
                    >
                      <div class="space-y-2">
                        <div class="font-bold text-white">{subnet.name}</div>
                        <div class="text-sm text-cyan-400">{subnet.description}</div>
                        <div class="text-xs break-all text-cyan-300/70">{subnet.id}</div>
                      </div>
                    </button>
                  {/each}
                </div>

                {#if inputError}
                  <div class="p-4 mt-4 border border-red-500/30 bg-red-950/20">
                    <div class="flex items-center space-x-3">
                      <span class="text-xl text-red-400">⚠️</span>
                      <div class="space-y-1">
                        <p class="font-bold text-red-400">Error</p>
                        <p class="text-sm text-red-300/80">{inputError}</p>
                      </div>
                    </div>
                  </div>
                {/if}

                <div class="p-4 mt-4 text-sm border rounded-md border-cyan-500/30 bg-cyan-950/50">
                  <p class="text-cyan-400">💡 Tip: Each subnet has different characteristics. Choose based on your needs.</p>
                  <p class="mt-2 text-cyan-300/70">All subnets provide high security and reliability.</p>
                </div>
              </div>
            {:else if currentStep === 3}
              <!-- Token Name -->
              <div class="w-full max-w-xl space-y-6">
                <h3 class="text-3xl font-bold text-white">What's your token name?</h3>
                <p class="text-lg text-cyan-400">Choose a memorable name for your token</p>
                <div class="space-y-2">
                  <input
                    bind:value={tokenName}
                    type="text"
                    class="w-full px-6 py-4 text-2xl text-white transition-colors bg-black border-2 border-cyan-500 focus:border-cyan-400 focus:outline-none"
                    placeholder="MyAwesomeToken"
                  />
                  <div class="mt-4 space-y-2">
                    <p class="text-sm text-cyan-400">Examples of good token names:</p>
                    <div class="grid grid-cols-2 gap-2">
                      {#each nameExamples as example}
                        <div class="p-2 text-sm text-white border border-cyan-500/30 bg-cyan-950/50">
                          {example}
                        </div>
                      {/each}
                    </div>
                  </div>
                  {#if inputError}
                    <div class="p-4 mt-4 border border-red-500/30 bg-red-950/20">
                      <div class="flex items-center space-x-3">
                        <span class="text-xl text-red-400">⚠️</span>
                        <div class="space-y-1">
                          <p class="font-bold text-red-400">Error</p>
                          <p class="text-sm text-red-300/80">{inputError}</p>
                        </div>
                      </div>
                    </div>
                  {/if}
                </div>
              </div>
            {:else if currentStep === 4}
              <!-- Token Ticker -->
              <div class="w-full max-w-xl space-y-6">
                <h3 class="text-3xl font-bold text-white">Choose your ticker symbol</h3>
                <p class="text-lg text-cyan-400">A short symbol for your token (2-5 characters)</p>
                <div class="space-y-2">
                  <input
                    bind:value={tokenTicker}
                    type="text"
                    class="w-full px-6 py-4 text-2xl text-white uppercase transition-colors bg-black border-2 border-cyan-500 focus:border-cyan-400 focus:outline-none"
                    placeholder="TOKEN"
                    maxLength="6"
                    on:input={(e) => {
                      if (e.target instanceof HTMLInputElement) {
                        // Remove any existing $ and trim whitespace
                        let value = e.target.value.replace('$', '').trim();
                        // Ensure max length of actual token symbol is 5
                        value = value.slice(0, 5);
                        // Add $ prefix if there's content
                        tokenTicker = value ? `$${value}` : '';
                      }
                    }}
                  />
                  <div class="mt-4 space-y-2">
                    <p class="text-sm text-cyan-400">Examples of good ticker symbols:</p>
                    <div class="grid grid-cols-4 gap-2">
                      {#each tickerExamples as example}
                        <div class="p-2 text-sm text-center text-white border border-cyan-500/30 bg-cyan-950/50">
                          ${example}
                        </div>
                      {/each}
                    </div>
                  </div>
                  {#if inputError}
                    <div class="p-4 mt-4 border border-red-500/30 bg-red-950/20">
                      <div class="flex items-center space-x-3">
                        <span class="text-xl text-red-400">⚠️</span>
                        <div class="space-y-1">
                          <p class="font-bold text-red-400">Error</p>
                          <p class="text-sm text-red-300/80">{inputError}</p>
                        </div>
                      </div>
                    </div>
                  {/if}
                </div>
              </div>
            {:else if currentStep === 5}
              <!-- Total Supply -->
              <div class="w-full max-w-xl space-y-6">
                <h3 class="text-3xl font-bold text-white">Set your total supply</h3>
                <p class="text-lg text-cyan-400">The maximum number of tokens that will exist</p>
                <div class="space-y-2">
                  <input
                    bind:value={totalSupply}
                    type="number"
                    min="1"
                    class="w-full px-6 py-4 text-2xl text-white transition-colors bg-black border-2 border-cyan-500 focus:border-cyan-400 focus:outline-none"
                    placeholder="1000000000"
                  />
                  <p class="text-sm text-cyan-400">Tip: Most tokens use 1,000,000,000 (one billion) as their total supply</p>
                  {#if inputError}
                    <div class="p-4 mt-4 border border-red-500/30 bg-red-950/20">
                      <div class="flex items-center space-x-3">
                        <span class="text-xl text-red-400">⚠️</span>
                        <div class="space-y-1">
                          <p class="font-bold text-red-400">Error</p>
                          <p class="text-sm text-red-300/80">{inputError}</p>
                        </div>
                      </div>
                    </div>
                  {/if}
                </div>
              </div>
            {:else if currentStep === 6}
              <!-- Confirmation Screen -->
              <div class="w-full max-w-xl space-y-6">
                {#if isLaunching || launchStatus.includes('Error')}
                  <!-- Enhanced Deployment Progress UI -->
                  <div class="space-y-6">
                    <!-- Progress bar with percentage -->
                    <div class="relative w-full h-3 mb-2 overflow-hidden bg-gray-800">
                      <div 
                        class="absolute top-0 left-0 h-full transition-all duration-500 bg-gradient-to-r from-cyan-500 to-cyan-400"
                        style="width: {deploymentProgress}%"
                      ></div>
                    </div>
                    
                    <!-- Enhanced step indicators -->
                    <div class="space-y-3">
                      {#each deploymentSteps as step}
                        <div class={`
                          flex items-center justify-between p-4 border transition-all duration-300
                          ${step.status === 'completed' ? 'border-green-500/50 bg-green-950/20' : 
                            step.status === 'processing' ? 'border-cyan-500 bg-cyan-950/20' : 
                            step.status === 'error' ? 'border-red-500/50 bg-red-950/20' : 
                            'border-gray-700 bg-gray-900/30'}
                        `}>
                          <div class="flex items-center space-x-3">
                            <!-- Enhanced Status Icon -->
                            <div class="flex-none w-8 h-8">
                              {#if step.status === 'completed'}
                                <div class="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/20">
                                  <span class="text-lg text-green-400">✓</span>
                                </div>
                              {:else if step.status === 'error'}
                                <div class="flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20">
                                  <span class="text-lg text-red-400">×</span>
                                </div>
                              {:else if step.status === 'processing'}
                                <div class="relative flex items-center justify-center w-8 h-8">
                                  <!-- Outer spinning circle -->
                                  <div class="absolute w-8 h-8 border-4 rounded-full border-t-cyan-400 border-r-cyan-400 border-b-cyan-400/30 border-l-cyan-400/30 animate-spin"></div>
                                  <!-- Inner pulsing dot -->
                                  <div class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                                </div>
                              {:else}
                                <div class="flex items-center justify-center w-8 h-8 rounded-full bg-gray-800/50">
                                  <div class="w-2 h-2 bg-gray-600 rounded-full"></div>
                                </div>
                              {/if}
                            </div>
                            
                            <!-- Step Info with Progress Details -->
                            <div class="flex-1 space-y-1">
                              <span class={`font-bold ${
                                step.status === 'completed' ? 'text-green-400' :
                                step.status === 'processing' ? 'text-cyan-400' :
                                step.status === 'error' ? 'text-red-400' :
                                'text-gray-400'
                              }`}>{step.name}</span>
                              
                              <!-- Enhanced Status Text with Sub-steps -->
                              <div class="text-sm">
                                {#if step.step === 3 && (step.status === 'processing' || step.status === 'completed')}
                                  <div class="space-y-1">
                                    <div class="flex items-center space-x-2">
                                      {#if step.status === 'completed'}
                                        <div class="w-1 h-1 bg-green-400 rounded-full"></div>
                                        <span class="text-green-400/70">ICP Transfer Complete</span>
                                      {:else}
                                        <div class="w-1 h-1 rounded-full bg-cyan-400 animate-pulse"></div>
                                        <span class="text-cyan-400/70">Processing ICP Transfer...</span>
                                      {/if}
                                    </div>
                                  </div>
                                {:else if step.status === 'completed'}
                                  <span class="text-green-400/70">Successfully completed</span>
                                {:else if step.status === 'error'}
                                  <span class="text-red-400/70">Failed to complete</span>
                                {:else if step.status === 'processing'}
                                  <span class="text-cyan-400/70">Processing...</span>
                                {:else}
                                  <span class="text-gray-500">Waiting to start</span>
                                {/if}
                              </div>
                            </div>
                          </div>

                          <!-- Step Number -->
                          <div class="flex items-center justify-center w-8 h-8 text-sm border rounded-full border-cyan-500/30">
                            {step.step}
                          </div>
                        </div>
                      {/each}
                    </div>

                    {#if launchStatus}
                      <div class={`p-4 mt-4 border ${
                        launchStatus.includes('Error') ? 
                          'border-red-500/30 bg-red-950/20' : 
                          'border-cyan-500/30 bg-cyan-950/30'
                      }`}>
                        <div class="flex items-center space-x-3">
                          {#if launchStatus.includes('Error')}
                            <span class="text-xl text-red-400">⚠️</span>
                            <div class="space-y-1">
                              <p class="font-bold text-red-400">Deployment Error</p>
                              <p class="text-sm text-red-300/80">{launchStatus.replace('Error:', '').trim()}</p>
                              <button 
                                on:click={() => {
                                  isLaunching = false;
                                  launchStatus = "";
                                  // Reset error states in deployment steps
                                  deploymentSteps = deploymentSteps.map(s => ({ ...s, status: 'pending' }));
                                }}
                                class="px-4 py-2 mt-3 text-sm font-bold text-white transition-all duration-300 border border-red-500/50 hover:bg-red-500/20"
                              >
                                TRY AGAIN
                              </button>
                            </div>
                          {:else}
                            <span class="text-xl text-cyan-400">💡</span>
                            <p class="text-cyan-400">{launchStatus}</p>
                          {/if}
                        </div>
                      </div>
                    {/if}
                  </div>
                {:else}
                  <h3 class="text-3xl font-bold text-white">Confirm Your Token</h3>
                  <div class="p-6 space-y-4 border-2 border-cyan-500 bg-cyan-950">
                    <div class="flex justify-between text-lg">
                      <span class="text-cyan-400">Network</span>
                      <span class="font-bold text-white">Internet Computer</span>
                    </div>
                    <div class="flex justify-between text-lg">
                      <span class="text-cyan-400">Token Name</span>
                      <span class="font-bold text-white">{tokenName.trim()}</span>
                    </div>
                    <div class="flex justify-between text-lg">
                      <span class="text-cyan-400">Token Ticker</span>
                      <span class="font-bold text-white">{tokenTicker.trim().toUpperCase()}</span>
                    </div>
                    <div class="flex justify-between text-lg">
                      <span class="text-cyan-400">Total Supply</span>
                      <span class="font-bold text-white">{Number(totalSupply).toLocaleString()}</span>
                    </div>
                    <div class="flex justify-between text-lg">
                      <span class="text-cyan-400">Cost</span>
                      <span class="font-bold text-white">{KONG_PRICE} $KONG</span>
                    </div>
                    <div class="my-2 border-t border-cyan-500/30"></div>
                    <div class="flex justify-between text-lg">
                      <span class="text-cyan-400">Your KONG Balance</span>
                      <div class="flex items-center space-x-2">
                        <span class="font-bold text-white">
                          {#if kongBalance !== null}
                            {(Number(kongBalance) / 100_000_000).toFixed(4)}
                          {:else}
                            --
                          {/if}
                        </span>
                        <span class="text-cyan-300">KONG</span>
                      </div>
                    </div>
                    <div class="flex justify-between text-lg">
                      <span class="text-cyan-400">Your ICP Balance</span>
                      <div class="flex items-center space-x-2">
                        <span class="font-bold text-white">
                          {#if subaccountBalance !== null}
                            {(Number(subaccountBalance) / 100_000_000).toFixed(4)}
                          {:else}
                            --
                          {/if}
                        </span>
                        <span class="text-cyan-300">ICP</span>
                      </div>
                    </div>
                  </div>

                  <!-- Add the swap interface before the warning -->
                  <div class="p-6 mt-4 space-y-4 border-2 border-cyan-500 bg-cyan-950/50">
                    <div class="flex items-center justify-between">
                      <h4 class="text-xl font-bold text-white">Quick Swap</h4>
                      <div class="px-3 py-1 text-sm border rounded-full border-cyan-500/30 bg-cyan-500/10">
                        <span class="text-cyan-400">1 KONG ≈ 0.01 ICP</span>
                      </div>
                    </div>
                    
                    <!-- Swap Box -->
                    <div class="p-4 space-y-3 border border-cyan-500/30 bg-black/20">
                      <!-- From -->
                      <div class="flex items-center justify-between p-3 border border-cyan-500/20 bg-cyan-950/30">
                        <div class="space-y-1">
                          <span class="text-sm text-cyan-400/70">From</span>
                          <div class="text-xl font-bold text-white">50 KONG</div>
                        </div>
                        <div class="text-sm text-right text-cyan-400/70">
                          Balance: {#if kongBalance !== null}
                            {(Number(kongBalance) / 100_000_000).toFixed(2)}
                          {:else}
                            --
                          {/if}
                        </div>
                      </div>

                      <!-- Swap Icon -->
                      <div class="flex items-center justify-center">
                        <div class="p-2 border rounded-full border-cyan-500/30 bg-cyan-950/30">
                          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-cyan-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                          </svg>
                        </div>
                      </div>

                      <!-- To -->
                      <div class="flex items-center justify-between p-3 border border-cyan-500/20 bg-cyan-950/30">
                        <div class="space-y-1">
                          <span class="text-sm text-cyan-400/70">To (estimated)</span>
                          <div class="text-xl font-bold text-white">0.5 ICP</div>
                        </div>
                        <div class="text-sm text-right text-cyan-400/70">
                          Balance: {#if subaccountBalance !== null}
                            {(Number(subaccountBalance) / 100_000_000).toFixed(2)}
                          {:else}
                            --
                          {/if}
                        </div>
                      </div>
                    </div>

                    <!-- Swap Button -->
                    <button
                      on:click={(event) => handleSwap(event)}
                      disabled={isSwapping || (kongBalance !== null && kongBalance < BigInt(50 * 1e8))}
                      class="w-full px-6 py-4 text-lg font-bold text-white transition-all duration-300 border-2 border-cyan-400 hover:bg-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                      {#if isSwapping}
                        <div class="flex items-center justify-center space-x-2">
                          <div class="w-5 h-5 border-2 border-t-2 border-white rounded-full border-t-transparent animate-spin"></div>
                          <span>{swapStatus}</span>
                        </div>
                      {:else}
                        Swap 50 KONG to ICP
                      {/if}
                    </button>

                    <!-- Status Messages -->
                    {#if swapStatus && !swapError}
                      <div class="p-4 text-sm border rounded border-green-500/30 bg-green-950/20">
                        <div class="flex items-center space-x-2">
                          <span class="text-green-400">✓</span>
                          <span class="text-green-400">{swapStatus}</span>
                        </div>
                      </div>
                    {/if}

                    {#if swapError}
                      <div class="p-4 text-sm border rounded border-red-500/30 bg-red-950/20">
                        <div class="flex items-center space-x-2">
                          <span class="text-red-400">⚠️</span>
                          <span class="text-red-400">{swapError}</span>
                        </div>
                      </div>
                    {/if}

                    <!-- Info Box -->
                    <div class="p-4 text-sm border rounded border-cyan-500/30 bg-cyan-950/20">
                      <div class="flex items-center space-x-2">
                        <span class="text-cyan-400">💡</span>
                        <span class="text-cyan-400/80">Swap 50 KONG tokens to receive approximately 0.5 ICP. Rate may vary slightly due to market conditions.</span>
                      </div>
                    </div>
                  </div>

                  <!-- Add warnings for insufficient balances -->
                  {#if kongBalance !== null && kongBalance < BigInt(KONG_PRICE * 100_000_000)}
                    <div class="p-4 mt-4 text-sm border rounded border-yellow-500/30 bg-yellow-500/5">
                      <p class="text-yellow-400">⚠️ Insufficient KONG balance. You need {KONG_PRICE} KONG to create a token.</p>
                      <p class="mt-2 text-yellow-300/70">Please acquire more KONG tokens to continue.</p>
                    </div>
                  {/if}
                {/if}
              </div>
            {/if}

            <!-- Navigation Buttons -->
            {#if currentStep > 0}
              <div class="flex justify-between w-full max-w-xl mt-auto">
                <button 
                  on:click={prevStep}
                  class="px-4 py-3 text-base font-bold text-white transition-all duration-300 border-2 md:px-8 md:py-4 md:text-lg border-cyan-500 hover:bg-cyan-500/20"
                >
                  ← BACK
                </button>

                {#if currentStep < steps.length - 1}
                  <button 
                    on:click={nextStep}
                    class="px-4 py-3 text-base font-bold text-white transition-all duration-300 border-2 md:px-8 md:py-4 md:text-lg border-cyan-400 hover:bg-cyan-500/20"
                  >
                    NEXT →
                  </button>
                {:else}
                  <button 
                    on:click={launchToken}
                    disabled={isLaunching}
                    class="px-4 py-3 text-base font-bold text-white transition-all duration-300 border-2 md:px-8 md:py-4 md:text-lg border-cyan-400 bg-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLaunching ? 'DEPLOYING...' : 'DEPLOY TOKEN →'}
                  </button>
                {/if}
              </div>
            {/if}

            <!-- Add test button before the start button -->
            <button
              on:click={() => {
                tokenName = "KongPad";
                tokenTicker = "PAD";
                selectedSubnet = subnets[0].id;
                currentStep = 1;
              }}
              class="w-full px-6 py-4 text-lg font-bold text-white transition-all duration-300 border-2 border-cyan-400 hover:bg-cyan-500/20"
            >
              Test with Sample Data
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Add test buttons in a development tools section -->
{#if import.meta.env.DEV}
  <div class="p-4 mt-8 border-2 rounded-lg border-cyan-500 bg-cyan-950/50">
    <h3 class="mb-4 text-xl font-bold text-white">Development Tools</h3>
    <div class="flex gap-4">
      <button
        on:click={testSwap}
        class="px-4 py-2 text-white transition-colors bg-purple-600 rounded hover:bg-purple-700"
      >
        Test Swap (1 KONG)
      </button>
      <button
        on:click={testDeploy}
        class="px-4 py-2 text-white transition-colors bg-purple-600 rounded hover:bg-purple-700"
      >
        Test Deploy Token
      </button>
    </div>
    <p class="mt-2 text-sm text-cyan-300">Note: These buttons are only visible in development mode</p>
  </div>
{/if}

<style>
  /* Add smooth transitions */
  .transition-all {
    transition-property: all;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 300ms;
  }

  /* Custom scrollbar */
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

  /* Add smooth transitions for error states */
  .error-transition {
    transition: all 0.3s ease-in-out;
  }
</style>
