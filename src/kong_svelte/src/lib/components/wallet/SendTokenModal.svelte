<script lang="ts">
  import { onMount } from 'svelte';
  import Modal from "$lib/components/common/Modal.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import TransferConfirmationModal from "$lib/components/wallet/TransferConfirmationModal.svelte";
  import { 
    ArrowRight, 
    Clipboard, 
    Camera, 
    Info, 
    ArrowUp,
    X, 
    Check 
  } from 'lucide-svelte';
  import { tooltip } from "$lib/actions/tooltip";
  import { auth } from "$lib/stores/auth";
  import { IcrcService } from "$lib/services/icrc/IcrcService";
  import { toastStore } from "$lib/stores/toastStore";
  import BigNumber from "bignumber.js";
  import { 
    calculateMaxAmount, 
    validateTokenAmount, 
    validateAddress, 
    formatTokenInput,
    getInitialBalances,
  } from "$lib/utils/validators/tokenValidators";
  import QrScanner from "$lib/components/common/QrScanner.svelte";
  import { getAccountIds } from "$lib/utils/accountUtils";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  // Props type definition
  type SendTokenModalProps = {
    token: any;
    isOpen?: boolean;
    onClose?: () => void;
    onSuccess?: (txId: string) => void;
  };

  // Destructure props with defaults
  let { 
    token, 
    isOpen = false,
    onClose = () => {},
    onSuccess = () => {}
  }: SendTokenModalProps = $props();

  // State for sending tokens
  let recipientAddress = $state("");
  let amount = $state("");
  let isValidating = $state(false);
  let errorMessage = $state("");
  let tokenFee = $state<bigint>(BigInt(0));
  let showScanner = $state(false);
  let hasCamera = $state(false);
  let selectedAccount = $state<"main" | "subaccount">("main");
  let accounts = $state({
    subaccount: "",
    main: "",
  });

  // For transfer confirmation
  let showConfirmation = $state(false);
  let transferDetails = $state<{
    amount: string;
    token: any;
    tokenFee: bigint;
    toPrincipal: string;
  } | null>(null);

  // Validation state
  let balances = $state<{ default: bigint, subaccount?: bigint }>(getInitialBalances(token?.symbol));
  let addressValidation = $state({ isValid: false, errorMessage: "", addressType: null });
  let amountValidation = $state({ isValid: false, errorMessage: "" });

  // Modal visibility handling to make animations work better
  let mounted = $state(false);
  let closing = $state(false);
  
  $effect(() => {
    if (!mounted && isOpen) {
      mounted = true;
    }
  });
  
  // Watch isOpen changes
  $effect(() => {
    if (!isOpen && mounted) {
      closing = true;
    }
  });

  // Close the modal with animation
  function handleClose() {
    closing = true;
    // Wait for animation to complete
    setTimeout(() => {
      onClose();
    }, 200);
  }

  // Load token fee
  async function loadTokenFee() {
    try {
      tokenFee = await IcrcService.getTokenFee(token);
    } catch (error) {
      console.error("Error loading token fee:", error);
      tokenFee = BigInt(10000); // Fallback to default fee
    }
  }

  // Load user balances
  async function loadBalances() {
    try {
      // Safety check to ensure token is still valid
      if (!token || !token.symbol) {
        console.debug("Token not available for balance loading");
        return;
      }
      
      if (token.symbol === "ICP" && auth.pnp?.account?.subaccount) {
        const subaccountResult = await IcrcService.getIcrc1Balance(
          token,
          auth.pnp.account.owner,
          Array.from(auth.pnp.account.subaccount)
        );
        if (typeof subaccountResult === 'bigint') {
          balances.subaccount = subaccountResult;
        }
      }
      
      const defaultResult = await IcrcService.getIcrc1Balance(token, auth.pnp?.account?.owner);
      if (typeof defaultResult === 'bigint') {
        balances.default = defaultResult;
      }
    } catch (error) {
      console.error("Error loading balances:", error);
    }
  }

  // Calculate max amount user can send
  const maxAmount = $derived(
    token?.symbol === "ICP"
      ? calculateMaxAmount(
          selectedAccount === "main" ? balances.default : balances.subaccount || BigInt(0),
          token.decimals,
          tokenFee
        )
      : calculateMaxAmount(balances.default, token.decimals, tokenFee)
  );

  // Handle amount input
  function handleAmountInput(event: Event) {
    const input = event.target as HTMLInputElement;
    amount = formatTokenInput(input.value, token.decimals);
  }

  // Handle "Send Max" button click
  function handleSendMax() {
    amount = String(maxAmount);
  }

  // Handle recipient address input
  function handleAddressInput(event: Event) {
    const input = event.target as HTMLInputElement;
    recipientAddress = input.value.trim();
  }

  // Handle QR scanner button click
  function handleScanClick() {
    if (hasCamera) {
      showScanner = true;
    } else {
      toastStore.warning("No camera detected on your device");
    }
  }

  // Handle address paste
  async function handleAddressPaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        recipientAddress = text.trim();
      }
    } catch (err) {
      console.error("Failed to read clipboard:", err);
      toastStore.error("Failed to access clipboard");
    }
  }

  // Handle QR scan result
  function handleScan(data: string) {
    showScanner = false;
    if (data) {
      // Extract address from URI if needed
      const addressMatch = data.match(/(?:canister:)?([\w-]+)(?:\?|$)/);
      recipientAddress = addressMatch ? addressMatch[1] : data;
    }
  }

  // Handle token send
  async function handleSubmit() {
    isValidating = true;
    errorMessage = "";

    if (!isFormValid) {
      isValidating = false;
      return;
    }

    // Prepare transfer details for confirmation
    transferDetails = {
      amount,
      token,
      tokenFee,
      toPrincipal: recipientAddress,
    };

    // Show transfer confirmation modal
    showConfirmation = true;
    isValidating = false;
  }

  // Handle account change
  function handleAccountChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    selectedAccount = select.value as "main" | "subaccount";
  }

  // Check if camera is available
  async function checkCameraAvailability() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      hasCamera = devices.some((device) => device.kind === "videoinput");
    } catch (err) {
      console.debug("Error checking camera:", err);
      hasCamera = false;
    }
  }

  // Handle confirmation close
  function handleConfirmationClose() {
    showConfirmation = false;
    transferDetails = null;
  }

  // Handle confirmation confirm
  async function handleConfirmationConfirm() {
    if (!transferDetails) return;
    
    isValidating = true;
    errorMessage = "";
    showConfirmation = false;

    try {
      const decimals = token.decimals || 8;
      const amountBigInt = BigInt(
        new BigNumber(amount).times(new BigNumber(10).pow(decimals)).toString()
      );

      toastStore.info(`Sending ${amount} ${token.symbol}...`);

      // Ensure auth is properly initialized
      if (!auth.pnp?.account?.owner) {
        throw new Error("Authentication not initialized");
      }

      // Prepare from subaccount
      let fromSubaccount;
      if (selectedAccount === "subaccount" && auth.pnp?.account?.subaccount) {
        // Ensure subaccount is properly formatted as Uint8Array for the IcrcService
        fromSubaccount = new Uint8Array(auth.pnp.account.subaccount);
      }

      const result = await IcrcService.transfer(
        token,
        recipientAddress,
        amountBigInt,
        {
          fee: token.fee_fixed ? BigInt(token.fee_fixed) : tokenFee,
          fromSubaccount: fromSubaccount ? Array.from(fromSubaccount) : undefined,
        }
      );

      if (result?.Ok) {
        const txId = result.Ok.toString();
        
        // Update local state first
        recipientAddress = "";
        amount = "";
        
        // Try to update balances before closing the modal
        try {
          await loadBalances();
        } catch (balanceError) {
          console.error("Failed to refresh balances:", balanceError);
          // Continue with success flow even if balance refresh fails
        }
        
        // Show success message and trigger callbacks
        toastStore.success(`Successfully sent ${token.symbol}`);
        onSuccess(txId);
        
        // Close modal last
        onClose();
      } else if (result?.Err) {
        const errMsg =
          typeof result.Err === "object"
            ? Object.keys(result.Err)[0]
            : String(result.Err);
        errorMessage = `Transfer failed: ${errMsg}`;
        toastStore.error(errorMessage);
        console.error("Transfer error details:", result.Err);
      }
    } catch (err) {
      console.error("Transfer error:", err);
      errorMessage = err.message || "Transfer failed";
      toastStore.error(errorMessage);
    } finally {
      isValidating = false;
    }
  }

  // Load account information
  $effect(() => {
    if (auth.pnp?.account?.owner) {
      const principal = auth.pnp.account.owner;
      const principalStr =
        typeof principal === "string" ? principal : principal?.toText?.() || "";
      accounts = getAccountIds(principalStr, auth.pnp?.account?.subaccount);
    }
  });

  // Validate address
  $effect(() => {
    if (recipientAddress) {
      addressValidation = validateAddress(recipientAddress, token.symbol, token.name);
    } else {
      addressValidation = { isValid: false, errorMessage: "", addressType: null };
    }
  });

  // Validate amount
  $effect(() => {
    if (amount) {
      const currentBalance = selectedAccount === "main" ? balances.default : balances.subaccount || BigInt(0);
      amountValidation = validateTokenAmount(amount, currentBalance, token.decimals, tokenFee);
    } else {
      amountValidation = { isValid: false, errorMessage: "" };
    }
  });

  // Update error message based on validations (separate effect to avoid circular dependencies)
  $effect(() => {
    if (addressValidation.errorMessage) {
      errorMessage = addressValidation.errorMessage;
    } else if (amountValidation.errorMessage) {
      errorMessage = amountValidation.errorMessage;
    } else {
      errorMessage = "";
    }
  });

  // Check if form is valid
  const isFormValid = $derived(
    amount &&
    recipientAddress &&
    !errorMessage &&
    addressValidation.addressType !== null &&
    addressValidation.isValid &&
    amountValidation.isValid
  );

  // Format tooltip message
  function getTooltipMessage(): string {
    if (!recipientAddress) return "Enter recipient address";
    if (!amount) return "Enter amount";
    if (errorMessage) return errorMessage;
    return "Send tokens";
  }

  // Initialize component
  onMount(() => {
    checkCameraAvailability();
    loadTokenFee();
    loadBalances();
  });
</script>

<Modal
  isOpen={isOpen}
  onClose={handleClose}
  title="Send {token.name}"
  width="480px"
  variant="transparent"
  height="auto"
  className="send-token-modal"
>
  <div class="p-4 flex flex-col gap-4">
    <!-- Token Info Banner -->
    <div 
      class="flex items-center gap-3 p-3 rounded-lg bg-kong-bg-light/10 border border-kong-border/30 transition-all duration-300"
      style="opacity: {closing ? 0 : (mounted ? 1 : 0)}; transform: translateY({closing ? '-10px' : (mounted ? 0 : '10px')});"
    >
      <div class="w-10 h-10 rounded-full bg-kong-bg-light p-1 border border-kong-border/20 flex-shrink-0">
        <TokenImages
          tokens={[token]}
          size={32}
          showSymbolFallback={true}
        />
      </div>
      <div class="flex flex-col">
        <div class="text-kong-text-primary font-medium">{token.name}</div>
        <div class="text-sm text-kong-text-secondary">Balance: {formatBalance(balances.default.toString(), token.decimals)} {token.symbol}</div>
      </div>
    </div>

    <!-- Send Form -->
    <form 
      on:submit|preventDefault={handleSubmit}
      class="flex flex-col gap-3 transition-all duration-300"
      style="opacity: {closing ? 0 : (mounted ? 1 : 0)}; transform: translateY({closing ? '-10px' : (mounted ? 0 : '20px')});"
    >
      {#if token.symbol === "ICP" && auth.pnp?.account?.subaccount && balances.subaccount !== undefined}
        <!-- Account selector for ICP -->
        <div class="mb-1">
          <label for="account-select" class="block text-xs text-kong-text-secondary mb-1.5">From Account</label>
          <div class="relative">
            <select
              id="account-select"
              class="w-full py-2 px-3 bg-kong-bg-light/30 border border-kong-border/50 rounded-md text-sm text-kong-text-primary appearance-none"
              value={selectedAccount}
              on:change={handleAccountChange}
            >
              <option value="main">Main Account - {formatBalance(balances.default.toString(), token.decimals)} {token.symbol}</option>
              <option value="subaccount">Subaccount - {formatBalance(balances.subaccount.toString(), token.decimals)} {token.symbol}</option>
            </select>
            <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg class="w-4 h-4 text-kong-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      {/if}

      <!-- Recipient Address Input -->
      <div>
        <label for="recipient-address" class="block text-xs text-kong-text-secondary mb-1.5">Recipient Address</label>
        <div class="relative">
          <input
            id="recipient-address"
            type="text"
            class="w-full py-2 px-3 bg-kong-bg-light/30 border {addressValidation.isValid
              ? 'border-kong-primary/40'
              : recipientAddress
              ? 'border-kong-accent-red/40'
              : 'border-kong-border/50'} rounded-md text-sm text-kong-text-primary"
            placeholder="Enter Canister ID, Principal ID, or Account ID"
            bind:value={recipientAddress}
            on:input={handleAddressInput}
          />
          <div class="absolute inset-y-0 right-0 flex items-center gap-0.5">
            {#if addressValidation.isValid}
              <div class="p-1.5 text-kong-accent-green">
                <Check size={16} />
              </div>
            {/if}
            <button
              type="button"
              class="p-1.5 text-kong-text-secondary hover:text-kong-text-primary"
              on:click={handleAddressPaste}
              use:tooltip={{ text: "Paste from clipboard", direction: "top" }}
            >
              <Clipboard size={16} />
            </button>
            {#if hasCamera}
              <button
                type="button"
                class="p-1.5 text-kong-text-secondary hover:text-kong-text-primary"
                on:click={handleScanClick}
                use:tooltip={{ text: "Scan QR code", direction: "top" }}
              >
                <Camera size={16} />
              </button>
            {/if}
          </div>
        </div>
        {#if addressValidation.addressType && addressValidation.isValid}
          <div class="mt-1 text-xs text-kong-accent-green">
            Valid {addressValidation.addressType} address
          </div>
        {/if}
      </div>

      <!-- Amount Input -->
      <div>
        <div class="flex justify-between items-center mb-1.5">
          <label for="amount-input" class="block text-xs text-kong-text-secondary">Amount</label>
          <button
            type="button"
            class="text-xs text-kong-primary hover:text-kong-primary/80"
            on:click={handleSendMax}
          >
            Send Max
          </button>
        </div>
        <div class="relative">
          <input
            id="amount-input"
            type="text"
            class="w-full py-2 px-3 bg-kong-bg-light/30 border {amountValidation.isValid
              ? 'border-kong-primary/40'
              : amount
              ? 'border-kong-accent-red/40'
              : 'border-kong-border/50'} rounded-md text-sm text-kong-text-primary"
            placeholder="0.00"
            bind:value={amount}
            on:input={handleAmountInput}
          />
          <div class="absolute inset-y-0 right-0 flex items-center pr-3">
            <span class="text-kong-text-secondary">{token.symbol}</span>
          </div>
        </div>
        <div class="mt-1 text-xs flex justify-between items-center">
          <div class="text-kong-text-secondary">
            Max: {maxAmount} {token.symbol}
          </div>
          <div class="flex items-center gap-1 text-kong-text-secondary/70">
            <Info size={12} />
            <span>Fee: {tokenFee ? formatBalance(tokenFee, token.decimals) : "..."} {token.symbol}</span>
          </div>
        </div>
      </div>

      {#if errorMessage}
        <div 
          class="px-3 py-2 bg-kong-accent-red/10 border border-kong-accent-red/20 rounded-md text-sm text-kong-accent-red transition-all duration-300"
          style="opacity: {closing ? 0 : (mounted ? 1 : 0)};"
        >
          {errorMessage}
        </div>
      {/if}

      <!-- Submit Button -->
      <button
        type="submit"
        class="w-full py-3 px-4 mt-2 rounded-md flex items-center justify-center gap-2 font-medium text-white
               {isFormValid 
                 ? 'bg-kong-primary hover:bg-kong-primary/90' 
                 : 'bg-kong-primary/40 cursor-not-allowed'} 
               transition-all duration-300"
        style="opacity: {closing ? 0 : (mounted ? 1 : 0)}; transform: translateY({closing ? '-10px' : (mounted ? 0 : '10px')}); transition-delay: {closing ? '0ms' : '250ms'};"
        disabled={!isFormValid || isValidating}
        use:tooltip={{
          text: getTooltipMessage(),
          direction: "top",
          background: errorMessage ? "bg-kong-accent-red" : "bg-kong-bg-dark",
        }}
      >
        {#if isValidating}
          <div class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
          <span>Processing...</span>
        {:else}
          <ArrowUp size={18} />
          <span>Send {token.symbol}</span>
        {/if}
      </button>
    </form>
  </div>
</Modal>

<!-- QR Scanner Modal -->
{#if showScanner}
  <QrScanner
    isOpen={showScanner}
    onClose={() => (showScanner = false)}
    onScan={handleScan}
  />
{/if}

<!-- Confirmation Modal -->
{#if showConfirmation && transferDetails}
  <TransferConfirmationModal
    isOpen={showConfirmation}
    onClose={handleConfirmationClose}
    onConfirm={handleConfirmationConfirm}
    amount={transferDetails.amount}
    token={transferDetails.token}
    tokenFee={transferDetails.tokenFee}
    isValidating={isValidating}
    toPrincipal={transferDetails.toPrincipal}
  />
{/if}

<style>
  /* Add global CSS for the modal transitions */
  :global(.send-token-modal) {
    animation: fadeIn 0.25s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* This will be applied when the modal is closing */
  :global(.modal-closing) {
    animation: fadeOut 0.2s ease-out forwards !important;
  }

  @keyframes fadeOut {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(20px);
    }
  }
</style> 