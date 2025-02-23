<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { writable } from "svelte/store";
  import { Principal } from "@dfinity/principal";
  import { AccountIdentifier } from "@dfinity/ledger-icp";
  import { auth } from "$lib/services/auth";
  import {
    notifyCreateCanister,
  } from "$lib/auth";
  import { Actor, HttpAgent } from "@dfinity/agent";
  import { idlFactory as ledgerIDL } from "../../../../declarations/icp_ledger";
  import { canisterStore } from "$lib/stores/canisters";
  import Login from "$lib/components/Login.svelte";
  import { getWalletIdentity } from "$lib/utils/wallet";
  import {
    fetchSubnets,
    fetchICPPrice,
    fetchICPtoXDRRates,
    getMostRecentXDRRate,
    type Subnet,
  } from "$lib/services/ic-api";
  import { SwapService } from "$lib/services/SwapService";
  import { BigNumber } from "bignumber.js";

  // Define missing types
  interface ICPPrice {
    icp_usd_rate: [number, string][];
  }

  interface TransferResult {
    Ok?: bigint;
    Err?: string;
  }

  // Helper function to convert hex string to byte array
  function hex2Bytes(hex: string): number[] {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
  }

  // Constants for mainnet canister IDs (NNS ledger and CMC canister)
  const LEDGER_CANISTER_ID = Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai"); // ICP Ledger canister ID
  const CMC_CANISTER_ID = Principal.fromText("rkp4c-7iaaa-aaaaa-aaaca-cai"); // Cycles Minting Canister ID
  const CREATE_CANISTER_MEMO = 1095062083n; // Specific memo value CMC expects for canister creation
  const IC_DASHBOARD_URL = "https://dashboard.internetcomputer.org/canister/";

  // Add debug logging helper
  function debug(context: string, ...args: any[]) {
    console.log(`[KONG Debug][${context}]`, ...args);
  }

  // Add debug helper for T cycles calculation
  function debugTCycles(context: string, ...args: any[]) {
    console.log(`[KONG Debug][TCycles][${context}]`, ...args);
  }

  // Simplified stores
  export let amountKONG: string = "";
  export let amountICP: string = "";
  export const kongIcpRate = writable<string>("0");
  export const estimatedIcp = writable<string>("0");
  export const errorMessage = writable<string>("");
  export const status = writable<string>("");
  export const conversionRate = writable<any>(null);
  export const subnets = writable<Subnet[]>([]);
  export const icpPrice = writable<ICPPrice | null>(null);
  export const estimatedCycles = writable<string>("0");
  export const dashboardUrl = writable<string>("");
  export const selectedSubnet = writable<Subnet | null>(null);

  // KONG-related stores with debugging
  export const kongUsdPrice = writable<string>("0");
  export const swapStatus = writable<string>("");
  export const swapInProgress = writable<boolean>(false);
  export const kongNeeded = writable<string>("0");

  // Add canister creation tracking
  export const canisterCreationInProgress = writable<boolean>(false);

  // Subscribe to store changes for debugging
  kongIcpRate.subscribe((value) => debug("kongIcpRate changed", value));
  estimatedIcp.subscribe((value) => debug("estimatedIcp changed", value));
  kongUsdPrice.subscribe((value) => debug("kongUsdPrice changed", value));
  swapStatus.subscribe((value) => debug("swapStatus changed", value));

  let estimatedTCycles = "0";
  let showTestSection = false;
  let principal: Principal | null = null;
  let unsubscribe: () => void;
  let testAmount: string = "";
  let testPrincipal: string = "";
  let showWalletModal = false;

  // Add constants for token decimals
  const KONG_DECIMALS = 8;
  const ICP_DECIMALS = 8;

  // Update cycle constants
  const MIN_TCYCLES = 0.5; // Absolute minimum T cycles needed
  const RECOMMENDED_TCYCLES = 0.55; // Recommended minimum including creation costs
  const SET_MINIMUM_TCYCLES = 0.56; // Amount used when setting minimum (includes extra buffer)

  // Add step tracking
  let currentStep = 1;

  // Update helper to determine if step is active
  function isStepActive(stepNumber: number): boolean {
    if (stepNumber === 3 && ($swapInProgress || $swapStatus.includes("Executing KONG to ICP swap"))) return true;
    if (stepNumber === 4 && $canisterCreationInProgress && !$status.includes("🎉")) return true;
    return false;
  }

  // Update helper to determine if step is completed
  function isStepCompleted(stepNumber: number): boolean {
    if (stepNumber === 1) return !!amountKONG && Number(amountKONG) > 0;
    if (stepNumber === 2) return !!$selectedSubnet;
    if (stepNumber === 3) return $swapStatus.includes("completed successfully") || $status.includes("🎉");
    if (stepNumber === 4) return $status.includes("🎉");
    return false;
  }

  // Update step tracking
  $: {
    if (!amountKONG || Number(amountKONG) <= 0) {
      currentStep = 1;
    } else if (!$selectedSubnet) {
      currentStep = 2;
    } else if (!$swapInProgress && !$canisterCreationInProgress && !$status.includes("🎉")) {
      currentStep = 3;
    } else if ($swapInProgress || $swapStatus.includes("Executing KONG to ICP swap")) {
      currentStep = 3;
    } else if ($canisterCreationInProgress || $status.includes("Creating canister")) {
      currentStep = 4;
    } else if ($status.includes("🎉")) {
      currentStep = 4;
      // Ensure we stop any progress indicators when complete
      canisterCreationInProgress.set(false);
      swapInProgress.set(false);
    }
  }

  const steps = [
    { number: 1, title: "Amount", description: "Enter KONG amount" },
    { number: 2, title: "Subnet", description: "Select subnet" },
    { number: 3, title: "Convert", description: "Convert to cycles" },
    { number: 4, title: "Create", description: "Create canister" }
  ];

  // Function to calculate minimum KONG needed with buffer
  async function calculateMinimumKongNeeded() {
    try {
      if (!$conversionRate?.xdrRate || !$kongIcpRate) return "0";

      const requiredIcp = new BigNumber(SET_MINIMUM_TCYCLES)
        .multipliedBy(10000)
        .dividedBy($conversionRate.xdrRate);

      debug("Required ICP calculated", requiredIcp.toString());

      // Convert ICP to KONG
      const requiredKong = requiredIcp.dividedBy($kongIcpRate);
      
      debug("Required KONG calculated", requiredKong.toString());
      
      return requiredKong.toFixed(8);
    } catch (error) {
      console.error("Error calculating minimum KONG:", error);
      return "0";
    }
  }

  // Function to set minimum amount
  async function setMinimumAmount() {
    amountKONG = await calculateMinimumKongNeeded();
  }

  // Update TCycles calculation to show actual amount
  $: {
    try {
      debugTCycles("Starting calculation", {
        amountKONG,
        kongIcpRate: $kongIcpRate,
        conversionRate: $conversionRate?.xdrRate
      });

      if (!amountKONG || !$kongIcpRate || !$conversionRate?.xdrRate) {
        debugTCycles("Missing required values", {
          hasAmount: !!amountKONG,
          hasRate: !!$kongIcpRate,
          hasConversion: !!$conversionRate?.xdrRate
        });
        estimatedTCycles = "0";
      } else {
        // First convert KONG to ICP using rate
        const icpAmount = new BigNumber(amountKONG).multipliedBy($kongIcpRate);
        debugTCycles("ICP amount calculated", icpAmount.toString());

        // Then convert ICP to TCYCLES using conversion rate
        // Show actual T cycles (no reduction)
        const tcycles = icpAmount
          .multipliedBy($conversionRate.xdrRate)
          .dividedBy(10000);
        
        debugTCycles("Final T cycles (actual amount)", tcycles.toString());
        estimatedTCycles = tcycles.toFixed(2);
      }
    } catch (err) {
      console.error("Error calculating TCYCLES:", err);
      debugTCycles("Calculation error", err);
      estimatedTCycles = "0";
    }
  }

  // Add reactive statement for USD value
  $: {
    try {
      if (amountKONG && $kongIcpRate && $icpPrice?.icp_usd_rate?.[0]?.[1]) {
        // First convert KONG to ICP
        const icpAmount = new BigNumber(amountKONG).multipliedBy($kongIcpRate);
        // Then convert ICP to USD using latest ICP price
        const usdValue = icpAmount.multipliedBy($icpPrice.icp_usd_rate[0][1]);
        kongUsdPrice.set(usdValue.toFixed(2));
      } else {
        kongUsdPrice.set("0.00");
      }
    } catch (err) {
      console.error("Error calculating USD value:", err);
      kongUsdPrice.set("0.00");
    }
  }

  // Utility: convert ICP string (e.g. "1.234") to e8s (bigint of smallest ICP units)
  function icpToE8s(icpStr: string): bigint {
    const num = Number(icpStr);
    if (isNaN(num) || num < 0) {
      throw new Error("Please enter a valid positive number.");
    }
    return BigInt(Math.floor(num * 100_000_000));
  }

  // Fetch conversion rate and subnet information
  async function fetchCanisterInfo() {
    try {
      console.log("Fetching canister info...");

      // Fetch conversion rate
      const rates = await fetchICPtoXDRRates();
      console.log("Fetched ICP to XDR rates:", rates);
      const rate = getMostRecentXDRRate(rates.icp_xdr_conversion_rates);
      if (rate) {
        conversionRate.set(rate);
        console.log("Set conversion rate:", rate);
      }

      // Fetch subnets
      console.log("Fetching subnets...");
      const subnetList = await fetchSubnets();
      console.log("Fetched subnets:", subnetList);
      if (Array.isArray(subnetList) && subnetList.length > 0) {
        subnets.set(subnetList);
        console.log("Set subnets:", subnetList);
      } else {
        console.error("No subnets found or invalid subnet data:", subnetList);
        errorMessage.set("Failed to load subnets. Please try again.");
      }

      // Fetch ICP price
      const price = await fetchICPPrice();
      console.log("Fetched ICP price:", price);
      if (price && price.icp_usd_rate) {
        icpPrice.set(price);
        console.log("Set ICP price:", price);
      }

      // Fetch KONG/ICP rate
      await fetchKongIcpRate();
    } catch (error) {
      console.error("Error in fetchCanisterInfo:", error);
      errorMessage.set(
        "Failed to fetch canister information. Please try again.",
      );
      throw error;
    }
  }

  // Replace connectWallet function with toggleWalletModal
  function toggleWalletModal() {
    showWalletModal = !showWalletModal;
  }

  // Add handleLogin function
  function handleLogin() {
    showWalletModal = false;
    errorMessage.set("");
    status.set("");
  }

  // Initialize auth subscription on mount
  onMount(() => {
    unsubscribe = auth.subscribe(async ($auth) => {
      try {
        if ($auth.isConnected && $auth.account?.owner) {
          const possiblePrincipal = $auth.account.owner;
          if (!possiblePrincipal) {
            throw new Error("Invalid principal received from authentication");
          }
          principal = possiblePrincipal;
          await fetchCanisterInfo();
        } else {
          principal = null;
          conversionRate.set(null);
          subnets.set([]);
          icpPrice.set(null);
        }
      } catch (err) {
        console.error("Error in auth subscription:", err);
        errorMessage.set("Failed to process authentication. Please try again.");
        principal = null;
      }
    });
  });

  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });

  // Create proper SubAccount from principal
  function createSubAccount(principal: Principal): number[] {
    const bytes = principal.toUint8Array();
    const subaccount = new Uint8Array(32);
    subaccount[0] = bytes.length;
    subaccount.set(bytes, 1);
    return Array.from(subaccount);
  }

  // Update createCanister function to properly handle progress states
  async function createCanister(event: Event) {
    event.preventDefault();
    errorMessage.set("");
    status.set("");
    debug("Starting canister creation");

    try {
      if (!principal || !auth.pnp?.isWalletConnected()) {
        debug("No principal or wallet not connected");
        errorMessage.set("You must be logged in to create a canister.");
        return;
      }
      if (!amountKONG || Number(amountKONG) <= 0) {
        debug("Invalid KONG amount", amountKONG);
        errorMessage.set("Please enter a valid KONG amount.");
        return;
      }
      if (!$selectedSubnet) {
        debug("No subnet selected");
        errorMessage.set("Please select a subnet for your canister.");
        return;
      }

      // Execute KONG to ICP swap first
      swapStatus.set("Executing KONG to ICP swap...");
      swapInProgress.set(true);
      debug("Starting KONG to ICP swap", { amountKONG });

      const kongAmount = SwapService.toBigInt(amountKONG, KONG_DECIMALS);
      debug("Converted KONG amount to e8s", kongAmount.toString());

      const receivedIcpE8s = await SwapService.swapKongToIcp(kongAmount);
      debug("Received ICP from swap", receivedIcpE8s?.toString());

      if (!receivedIcpE8s) {
        throw new Error("Failed to swap KONG for ICP");
      }

      // Subtract fees (0.0002 ICP = 20000 e8s) to account for approval and transfer fees
      const TOTAL_FEES = 10000n; // 0.0001 ICP, we are using icrc1_transfer
      const adjustedIcpE8s = receivedIcpE8s - TOTAL_FEES;
      debug("Adjusted ICP amount after fees", adjustedIcpE8s.toString());

      // Convert adjusted ICP amount to decimal string
      const amountICP = SwapService.fromBigInt(adjustedIcpE8s, ICP_DECIMALS);
      debug("Converted adjusted ICP to decimal", amountICP);

      swapStatus.set("KONG swap completed successfully. Creating canister...");
      swapInProgress.set(false);
      canisterCreationInProgress.set(true);

      // Continue with canister creation using adjusted amount...
      debug("Proceeding with canister creation", { amountICP });

      if (!(principal instanceof Principal)) {
        throw new Error(
          "Invalid principal state. Please reconnect your wallet.",
        );
      }

      const identity = getWalletIdentity(auth.pnp);
      if (!identity) {
        throw new Error("No identity found. Please reconnect your wallet.");
      }

      const agent = new HttpAgent({
        host: "https://icp0.io",
        identity: identity,
      });

      await agent.fetchRootKey().catch(console.error);

      const ledger = Actor.createActor(ledgerIDL, {
        agent,
        canisterId: LEDGER_CANISTER_ID,
      });

      const amountE8s = icpToE8s(amountICP);

      // Create subaccount from principal
      const subaccount = createSubAccount(principal);

      // Create transfer args with CMC as owner and principal-derived subaccount
      const transferArgs = {
        to: { owner: CMC_CANISTER_ID, subaccount: [subaccount] },
        amount: adjustedIcpE8s,  // Use the adjusted amount that accounts for fees
        fee: [10000n],
        memo: [
          Array.from(
            new Uint8Array(new BigUint64Array([CREATE_CANISTER_MEMO]).buffer),
          ),
        ], 
        from_subaccount: [],
        created_at_time: [],
      };

      status.set("🚀 Sending ICP transfer to CMC...");
      const result = (await ledger.icrc1_transfer(
        transferArgs,
      )) as TransferResult;

      if ("Ok" in result) {
        const blockIndex = result.Ok;
        status.set(
          `✅ ICP transfer sent. Block index: ${blockIndex}. Notifying CMC...`,
        );

        if (!$selectedSubnet) {
          throw new Error("No subnet selected");
        }

        console.log("Selected subnet:", $selectedSubnet);
        console.log("Subnet ID to use:", $selectedSubnet.subnet_id);

        const notifyArgs = {
          blockIndex,
          controller: principal,
          subnet_selection: [
            {
              Subnet: {
                subnet: Principal.fromText($selectedSubnet.subnet_id),
              },
            },
          ],
          subnet_type: [],
          settings: {
            controllers: [principal],
            computeAllocation: BigInt(0),
            memoryAllocation: BigInt(0),
            freezingThreshold: BigInt(2_592_000),
          },
        };

        console.log("Calling notifyCreateCanister with args:", notifyArgs);
        // TODO: fix this type error
        const newCanisterId = await notifyCreateCanister(auth.pnp, notifyArgs);

        // Save the new canister to our store
        canisterStore.addCanister(newCanisterId, principal);

        // Set the dashboard URL
        dashboardUrl.set(`${IC_DASHBOARD_URL}${newCanisterId.toText()}`);
        status.set(
          `🎉 Canister created! New Canister ID: ${newCanisterId.toText()}`,
        );

        canisterCreationInProgress.set(false);
      } else {
        throw new Error(JSON.stringify(result.Err));
      }
    } catch (err: any) {
      console.error("Error during canister creation:", err);
      if (err?.message) {
        errorMessage.set("❗ " + err.message);
      } else {
        errorMessage.set("❗ An unexpected error occurred. See console for details.");
      }
      // Clear dashboard URL and reset states on error
      dashboardUrl.set("");
      canisterCreationInProgress.set(false);
      swapInProgress.set(false);
    }
  }

  async function testTransfer(event: Event) {
    event.preventDefault();
    errorMessage.set("");
    status.set("");

    try {
      const identity = getWalletIdentity(auth.pnp);
      if (!identity) {
        throw new Error("No identity found. Please reconnect your wallet.");
      }

      // Log identity details for debugging
      console.log("Using identity:", {
        principal: identity.getPrincipal().toText(),
        isAnonymous: identity.getPrincipal().isAnonymous(),
      });

      if (!testAmount || Number(testAmount) <= 0) {
        errorMessage.set("Please enter a valid test amount");
        return;
      }
      console.log("Test amount:", testAmount);

      if (!testPrincipal) {
        errorMessage.set("Please enter a destination principal");
        return;
      }
      console.log("Raw test principal:", testPrincipal);

      // Clean up the principal string
      const cleanPrincipal = testPrincipal.trim();
      console.log("Cleaned principal:", cleanPrincipal);

      // Basic format validation
      if (!/^[a-z0-9\-]+$/.test(cleanPrincipal)) {
        errorMessage.set(
          "Principal ID can only contain lowercase letters, numbers, and hyphens",
        );
        return;
      }

      // Create raw ledger actor
      console.log("Creating ledger actor...");

      const agent = new HttpAgent({
        host: "https://icp0.io",
        identity: identity,
      });

      // Ensure agent is authenticated
      await agent.fetchRootKey().catch(console.error);

      const ledger = Actor.createActor(ledgerIDL, {
        agent,
        canisterId: LEDGER_CANISTER_ID,
      });
      console.log("Created ledger actor");

      const amountE8s = icpToE8s(testAmount);
      console.log("Converted amount to e8s:", amountE8s.toString());

      try {
        console.log("Attempting to create Principal from:", cleanPrincipal);
        const toPrincipal = Principal.fromText(cleanPrincipal);
        console.log("Created Principal:", toPrincipal.toText());

        // Extra validation to ensure it's a valid principal
        if (toPrincipal.isAnonymous()) {
          errorMessage.set("Cannot transfer to anonymous principal");
          return;
        }

        console.log("Creating AccountIdentifier...");
        const accountId = AccountIdentifier.fromPrincipal({
          principal: toPrincipal,
        });
        console.log("Created AccountIdentifier");

        // Get the hex representation and convert to bytes
        const accountHex = accountId.toHex();
        console.log("Account hex:", accountHex);
        const accountBytes = hex2Bytes(accountHex);
        console.log("Account bytes:", accountBytes);

        const transferArgs = {
          to: {
            owner: toPrincipal,
            subaccount: [],
          },
          amount: amountE8s,
          fee: [10000n],
          memo: [],
          from_subaccount: [],
          created_at_time: [],
        };

        console.log(
          "Transfer args:",
          JSON.stringify(transferArgs, (_, v) =>
            typeof v === "bigint"
              ? v.toString()
              : v instanceof Principal
                ? v.toText()
                : v,
          ),
        );

        status.set("🧪 Sending test transfer...");
        console.log("Calling ledger.icrc1_transfer...");
        const result = await ledger.icrc1_transfer(transferArgs) as TransferResult;
        console.log("Transfer result:", result);

        if ("Ok" in result) {
          const blockIndex = result.Ok;
          console.log("Transfer complete, block index:", blockIndex);
          status.set(`✅ Test transfer complete! Block: ${blockIndex}`);
        } else {
          throw new Error(JSON.stringify(result.Err));
        }
      } catch (err: any) {
        console.error("Detailed error:", {
          message: err.message,
          stack: err.stack,
          name: err.name,
          cause: err.cause,
        });
        errorMessage.set(
          `Invalid principal format: ${err.message || 'Please check the principal ID format (e.g. "aaaaa-aa")'}`,
        );
        return;
      }
    } catch (err: any) {
      console.error("Test transfer failed:", {
        message: err.message,
        stack: err.stack,
        name: err.name,
        cause: err.cause,
      });
      errorMessage.set("❗ Test failed: " + (err.message || "Unknown error"));
    }
  }

  // Add reactive statement for ICP USD value
  $: icpValueUsd = $icpPrice?.icp_usd_rate?.[0]?.[1]
    ? Number($estimatedIcp) * Number($icpPrice.icp_usd_rate[0][1])
    : 0;

  // Add helper function to group subnets by type
  function groupSubnetsByType(subnets: Subnet[]): Record<string, Subnet[]> {
    return subnets.reduce(
      (groups, subnet) => {
        const type = subnet.subnet_type;
        if (!groups[type]) {
          groups[type] = [];
        }
        groups[type].push(subnet);
        return groups;
      },
      {} as Record<string, Subnet[]>,
    );
  }

  // Add function to calculate required KONG amount
  async function calculateRequiredKong() {
    try {
      if (!$conversionRate?.rate) return;

      // Calculate minimum ICP needed for 0.6T cycles
      const minTCycles = 0.6;
      const minIcpNeeded = new BigNumber(minTCycles)
        .multipliedBy(10000)
        .dividedBy($conversionRate.rate)
        .toString();

      // Convert minimum ICP to e8s
      const minIcpE8s = SwapService.toBigInt(minIcpNeeded, ICP_DECIMALS);

      // Get quote for 100 KONG to establish rate
      const hundredKongE8s = SwapService.toBigInt("100", KONG_DECIMALS);
      const quote = await SwapService.getKongToIcpQuote(
        hundredKongE8s,
        KONG_DECIMALS,
        ICP_DECIMALS,
      );

      // Calculate rate (ICP per KONG)
      const rate = new BigNumber(quote.receiveAmount);
      kongIcpRate.set(rate.dividedBy(100).toString());

      // Calculate required KONG amount
      const requiredKong = new BigNumber(minIcpNeeded).dividedBy(
        rate.dividedBy(100),
      );
    } catch (error) {
      console.error("Error calculating required KONG:", error);
      errorMessage.set("Failed to calculate required KONG amount");
    }
  }

  // Add function to execute KONG to ICP swap
  async function executeKongSwap() {
    try {
      if (!auth.pnp?.isWalletConnected()) {
        throw new Error("Wallet connection required");
      }

      swapStatus.set("Initiating KONG to ICP swap...");

      // Convert KONG amount to e8s
      const kongAmountE8s = SwapService.toBigInt(amountKONG, KONG_DECIMALS);

      // Execute swap with default slippage
      const receiveAmountE8s = await SwapService.swapKongToIcp(kongAmountE8s);

      if (receiveAmountE8s) {
        swapStatus.set("Swap successful! Proceeding with canister creation...");
        // Convert received amount back to decimal string
        amountICP = SwapService.fromBigInt(receiveAmountE8s, ICP_DECIMALS);
        return true;
      }

      throw new Error("Swap failed");
    } catch (error) {
      console.error("Error executing KONG swap:", error);
      errorMessage.set(error instanceof Error ? error.message : "Swap failed");
      return false;
    }
  }

  // Add type-safe event handler
  function handleSubnetChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const selected = $subnets.find((s) => s.subnet_id === target.value);
    if (selected) selectedSubnet.set(selected);
  }

  // Simplified rate fetching
  async function fetchKongIcpRate() {
    try {
      const oneKongE8s = SwapService.toBigInt("1", KONG_DECIMALS);
      const quote = await SwapService.getKongToIcpQuote(
        oneKongE8s,
        KONG_DECIMALS,
        ICP_DECIMALS,
      );
      kongIcpRate.set(quote.receiveAmount);
    } catch (error) {
      console.error("Error fetching KONG/ICP rate:", error);
      errorMessage.set("Failed to fetch KONG/ICP rate");
    }
  }
</script>
<!-- User Interface -->
<div class="min-h-screen py-8 bg-gray-900">
  {#if !principal}
    <div class="max-w-lg px-4 mx-auto">
      <div class="p-6 space-y-4 border border-gray-700 rounded-lg bg-gray-800/50">
        <h2 class="text-2xl font-bold text-white">Create New Canister with KONG</h2>
        <p class="text-center text-gray-400">Please connect your wallet to create a canister.</p>
        <button 
          on:click={toggleWalletModal}
          class="flex items-center justify-center w-full gap-2 px-4 py-3 font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800"
        >
          <span class="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
          <span class="text-cyan-400">CONNECT WALLET</span>
        </button>
      </div>
    </div>
  {:else}
    <div class="max-w-2xl px-4 mx-auto">
      <!-- Progress Steps -->
      <div class="mb-8">
        <div class="flex justify-between">
          {#each steps as step}
            <div class="relative flex flex-col items-center">
              <div class={`w-10 h-10 flex items-center justify-center rounded-full border-2 
                ${currentStep === step.number ? 'border-blue-500 bg-blue-500 text-white' : 
                isStepCompleted(step.number) ? 'border-green-500 bg-green-500 text-white' : 
                'border-gray-600 bg-gray-800 text-gray-400'}
                ${isStepActive(step.number) ? 'animate-pulse' : ''}`}>
                {#if isStepCompleted(step.number)}
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                {:else}
                  {step.number}
                {/if}
              </div>
              <div class="mt-2 text-center">
                <div class={`text-sm font-medium 
                  ${currentStep === step.number ? 'text-blue-500' : 
                  isStepCompleted(step.number) ? 'text-green-500' : 'text-gray-400'}
                  ${isStepActive(step.number) ? 'animate-pulse' : ''}`}>
                  {step.title}
                </div>
                <div class={`text-xs text-gray-500 ${isStepActive(step.number) ? 'animate-pulse' : ''}`}>
                  {step.description}
                </div>
              </div>
            </div>
            {#if step.number < steps.length}
              <div class="flex-1 mt-5">
                <div class={`h-0.5 ${isStepCompleted(step.number) ? 'bg-green-500' : 'bg-gray-600'}`}></div>
              </div>
            {/if}
          {/each}
        </div>
      </div>

      <form on:submit|preventDefault={createCanister} class="space-y-6">
        <div class="p-6 border border-gray-700 rounded-lg bg-gray-800/50">
          <h2 class="mb-6 text-2xl font-bold text-white">Create New Canister with KONG</h2>

          <!-- Status Messages -->
          {#if $status}
            <div class="p-4 mb-4 bg-green-100 border border-green-300 rounded-lg">
              <p class="text-green-800">{$status}</p>
              {#if $dashboardUrl}
                <a 
                  href={$dashboardUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  class="inline-flex items-center px-4 py-2 mt-2 font-medium text-indigo-700 transition-colors bg-indigo-100 rounded-md hover:bg-indigo-200"
                >
                  View Canister on IC Dashboard 🔗
                </a>
              {/if}
            </div>
          {/if}

          {#if $errorMessage}
            <div class="p-4 mb-4 bg-red-100 border border-red-300 rounded-lg">
              <p class="text-red-800">{$errorMessage}</p>
            </div>
          {/if}

          <!-- Amount Input -->
          <div class="space-y-2">
            <label class="block text-sm font-medium text-white">
              Amount of KONG to send:
              <div class="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.00000001"
                  bind:value={amountKONG}
                  placeholder="e.g. 1.5"
                  on:input={(e) => {
                    if (e.currentTarget.valueAsNumber < 0) {
                      e.currentTarget.value = "0";
                    }
                  }}
                  class="w-full px-4 py-3 mt-1 text-white placeholder-gray-400 bg-gray-900 border border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  on:click={setMinimumAmount}
                  class="px-4 py-3 mt-1 text-sm font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800"
                >
                  Set Minimum
                </button>
              </div>
            </label>
            <p class="text-xs text-gray-400">
              * Set Minimum amount includes a 10% safety buffer against rate fluctuations
            </p>
          </div>

          <!-- Value Info Box -->
          <div class="p-4 mt-6 space-y-4 border border-gray-700 rounded-lg bg-gray-800/50">
            <div class="grid grid-cols-2 gap-4">
              <div class="p-4 text-center border border-gray-700 rounded-lg bg-gray-900/50">
                <span class="block text-xs font-semibold tracking-wider text-gray-400 uppercase">USD VALUE</span>
                <span class="block mt-1 text-xl font-bold text-white">
                  ${amountKONG && $kongUsdPrice ? $kongUsdPrice : '0.00'}
                </span>
              </div>
              
              <div class={`bg-gray-900/50 rounded-lg border p-4 text-center ${Number(estimatedTCycles) < RECOMMENDED_TCYCLES ? 'border-red-500 bg-red-500/10' : 'border-gray-700'}`}>
                <span class="block text-xs font-semibold tracking-wider text-gray-400 uppercase">TCYCLES</span>
                <span class="block mt-1 text-xl font-bold text-white">
                  {amountKONG && $conversionRate ? `${estimatedTCycles} T` : '0 T'}
                </span>
                <div class="mt-2 space-y-1 text-xs text-left">
                  <p class="text-gray-400">Minimum Required: {MIN_TCYCLES}T</p>
                  <p class="text-yellow-400">Recommended: {RECOMMENDED_TCYCLES}T</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Subnet Selection -->
          <div class="mt-6 space-y-2">
            <label class="block text-sm font-medium text-white">
              Select Subnet:
              <select
                on:change={handleSubnetChange}
                required
                class="w-full px-4 py-3 mt-1 text-white placeholder-gray-400 bg-gray-900 border border-gray-700 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Choose a subnet...</option>
                {#each Object.entries(groupSubnetsByType($subnets)) as [type, subnetsOfType]}
                  <optgroup label={type}>
                    {#each subnetsOfType as subnet}
                      <option value={subnet.subnet_id}>
                        {subnet.subnet_id} ({subnet.status})
                      </option>
                    {/each}
                  </optgroup>
                {/each}
              </select>
            </label>
            {#if $selectedSubnet}
              <div class="p-4 mt-2 space-y-2 text-sm border border-gray-700 rounded-lg bg-gray-900/50">
                <p class="text-gray-400">Selected Subnet Details:</p>
                <p class="text-white">Type: {$selectedSubnet.subnet_type}</p>
                <p class="text-white">Status: {$selectedSubnet.status}</p>
              </div>
            {/if}
          </div>

          <button 
            type="submit" 
            disabled={!!$status && $status.startsWith("🚀")}
            class="w-full px-6 py-4 mt-6 font-medium text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Canister
          </button>
        </div>
      </form>
    </div>
  {/if}
</div>

<!-- Wallet Modal -->
{#if showWalletModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
    <Login on:close={toggleWalletModal} on:login={handleLogin} />
  </div>
{/if}
