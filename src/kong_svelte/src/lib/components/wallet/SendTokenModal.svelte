<script lang="ts">
  import { onMount } from "svelte";
  import Modal from "$lib/components/common/Modal.svelte";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import TransferConfirmationModal from "$lib/components/wallet/TransferConfirmationModal.svelte";
  import QrScanner from "$lib/components/common/QrScanner.svelte";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import {
    Clipboard,
    Camera,
    Info,
    ArrowUp,
    Check,
    AlertCircle,
    ScrollText,
  } from "lucide-svelte";
  import { tooltip } from "$lib/actions/tooltip";
  import { auth } from "$lib/stores/auth";
  import {
    currentUserBalancesStore,
    refreshSingleBalance,
  } from "$lib/stores/balancesStore";
  import { IcrcService } from "$lib/services/icrc/IcrcService";
  import { toastStore } from "$lib/stores/toastStore";
  import BigNumber from "bignumber.js";
  import {
    calculateMaxAmount,
    validateTokenAmount,
    validateAddress,
    formatTokenInput,
  } from "$lib/utils/validators/tokenValidators";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { decodeIcrcAccount, type IcrcAccount } from "@dfinity/ledger-icrc";

  // Format USD value with commas for thousands
  function formatUsdValue(value: string | number): string {
    try {
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(Number(value));
    } catch (e) {
      return value.toString();
    }
  }

  // Props and state
  let { token, isOpen = false, onClose = () => {}, onSuccess = () => {} } = $props<{
    token: Kong.Token;
    isOpen?: boolean;
    onClose?: () => void;
    onSuccess?: (txId: string) => void;
  }>();

  // Form state
  let recipientAddress = $state("");
  let amount = $state("");
  let isValidating = $state(false);
  let errorMessage = $state("");
  let tokenFee = $state<bigint>(BigInt(0));
  let showScanner = $state(false);
  let hasCamera = $state(false);
  let addressFocused = $state(false);
  let amountFocused = $state(false);
  let showConfirmation = $state(false);
  let transferDetails = $state<{ amount: string; token: Kong.Token; tokenFee: bigint; toPrincipal: string; } | null>(null);
  let showSuccess = $state(false);
  let mounted = $state(false);
  let closing = $state(false);
  let usdValue = $state<string>("0.00");

  // Derive balance
  const currentBalance = $derived($currentUserBalancesStore[token?.address]?.in_tokens ?? BigInt(0));
  const currentBalanceUsd = $derived($currentUserBalancesStore[token?.address]?.in_usd ?? BigInt(0));
  const authStore = $derived(auth);
  const maxAmount = $derived(calculateMaxAmount(currentBalance, token?.decimals, tokenFee));
  
  // Validation state
  let addressValidation = $state<{ isValid: boolean; errorMessage: string; addressType: "principal" | "account" | "icrc1" | null; }>({ 
    isValid: false, errorMessage: "", addressType: null 
  });
  let amountValidation = $state({ isValid: false, errorMessage: "" });
  
  // Check if form is valid
  const isFormValid = $derived(
    amount && recipientAddress && !errorMessage && 
    addressValidation.isValid && amountValidation.isValid && token
  );

  // Animation handling
  $effect(() => { if (!mounted && isOpen) mounted = true; });
  $effect(() => { if (!isOpen && mounted) closing = true; });

  // Validation effects
  $effect(() => {
    if (recipientAddress) {
      addressValidation = validateAddress(recipientAddress, token?.symbol, token?.name);
    } else {
      addressValidation = { isValid: false, errorMessage: "", addressType: null };
    }
  });

  $effect(() => {
    if (amount && token) {
      amountValidation = validateTokenAmount(amount, currentBalance, token.decimals, tokenFee);
    } else {
      amountValidation = { isValid: false, errorMessage: "" };
    }
  });

  $effect(() => {
    errorMessage = addressValidation.errorMessage || amountValidation.errorMessage || "";
  });

  // Calculate USD value when amount changes
  $effect(() => {
    if (amount && token?.metrics?.price) {
      try {
        usdValue = new BigNumber(amount).multipliedBy(token.metrics.price).toFixed(2);
      } catch (error) {
        console.error("Error calculating USD value:", error);
        usdValue = "0.00";
      }
    } else {
      usdValue = "0.00";
    }
  });

  // Close the modal with animation
  function handleClose() {
    closing = true;
    setTimeout(() => {
      resetState();
      onClose();
    }, 200);
  }

  // Reset all state
  function resetState() {
    recipientAddress = "";
    amount = "";
    errorMessage = "";
    addressFocused = false;
    amountFocused = false;
    closing = false;
    showSuccess = false;
  }

  // Load token fee
  async function loadTokenFee() {
    try {
      if (!token?.address) {
        tokenFee = BigInt(10000); // Fallback
        return;
      }
      tokenFee = await IcrcService.getTokenFee(token);
    } catch (error) {
      console.error("Error loading token fee:", error);
      tokenFee = BigInt(10000);
    }
  }

  // Refresh balance
  async function refreshBalanceOnMount() {
    const principalId = authStore.pnp?.account?.owner;
    if (token && principalId && principalId !== "anonymous") {
      try {
        await refreshSingleBalance(token, principalId, false);
      } catch (error) {
        console.error("Failed to refresh balance:", error);
        toastStore.error("Could not load balance.");
      }
    }
  }

  // Input handlers
  function handleAmountInput(event: Event) {
    amount = formatTokenInput((event.target as HTMLInputElement).value, token.decimals);
  }

  function handleSendMax() {
    amount = String(maxAmount);
  }

  function handleAddressInput(event: Event) {
    recipientAddress = (event.target as HTMLInputElement).value.trim();
  }

  function handleScanClick() {
    if (hasCamera) {
      showScanner = true;
    } else {
      toastStore.warning("No camera detected on your device");
    }
  }

  async function handleAddressPaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) recipientAddress = text.trim();
    } catch (err) {
      console.error("Failed to read clipboard:", err);
      toastStore.error("Failed to access clipboard");
    }
  }

  function handleScan(data: string) {
    showScanner = false;
    if (data) {
      const addressMatch = data.match(/(?:canister:)?([\w-]+)(?:\?|$)/);
      recipientAddress = addressMatch ? addressMatch[1] : data;
    }
  }

  // Handle form submission
  async function handleSubmit() {
    isValidating = true;
    errorMessage = "";

    if (!isFormValid) {
      isValidating = false;
      return;
    }

    transferDetails = { amount, token, tokenFee, toPrincipal: recipientAddress };
    showConfirmation = true;
    isValidating = false;
  }

  // Confirmation handlers
  function handleConfirmationClose() {
    showConfirmation = false;
    transferDetails = null;
    resetState();
    onClose();
  }

  async function handleConfirmationConfirm() {
    if (!transferDetails) return;

    let tokenCopy = token; // Keep a copy of the token symbol, so even if the modal is closed, we can still access the details

    isValidating = true;
    errorMessage = "";
    showConfirmation = false;

    try {
      const decimals = token.decimals || 8;
      const amountBigInt = BigInt(
        new BigNumber(amount).times(new BigNumber(10).pow(decimals)).toString()
      );

      toastStore.info(`Sending ${amount} ${token.symbol}...`);

      if (!authStore.pnp?.account?.owner) {
        throw new Error("Authentication not initialized");
      }
      
      // Prepare recipient
      let recipient: IcrcAccount | string;
      if (addressValidation.addressType === "account") {
        recipient = recipientAddress; // Legacy ICP Account ID
      } else {
        recipient = decodeIcrcAccount(recipientAddress);
      }

      const result = await IcrcService.transfer(
        token,
        recipient,
        amountBigInt,
        { fee: token.fee_fixed ? BigInt(token.fee_fixed) : tokenFee }
      );

      if (result?.Ok) {
        showSuccess = true;
        const txId = result.Ok.toString();
        
        // Update balance
        const principalId = authStore.pnp?.account?.owner;
        await refreshSingleBalance(tokenCopy, principalId, true);
        
        // Reset form for next transaction
        recipientAddress = "";
        amount = "";
        
        // Notify success
        toastStore.success(`Successfully sent ${tokenCopy.symbol}`);
        onSuccess(txId);
        
        // Keep modal open, but reset success state after a delay
        setTimeout(() => {
          showSuccess = false;
        }, 2000);
      } else if (result?.Err) {
        const errMsg = typeof result.Err === "object"
          ? Object.keys(result.Err)[0] 
          : String(result.Err);
        errorMessage = `Transfer failed: ${errMsg}`;
        toastStore.error(errorMessage);
      }
    } catch (err) {
      console.error("Transfer error:", err);
      let errorDetail = "Transfer failed";
      
      if (err instanceof Error) {
        errorDetail = err.message;
      } else if (typeof err === 'object' && err !== null) {
        const rejectCode = (err as any).reject_code;
        const rejectMessage = (err as any).reject_message;
        
        if (rejectCode !== undefined && rejectMessage !== undefined) {
          errorDetail = `Transfer failed (Code ${rejectCode}): ${rejectMessage}`;
        } else {
          try { errorDetail = JSON.stringify(err); } catch {}
        }
      }
      
      errorMessage = errorDetail;
      toastStore.error(errorMessage);
    } finally {
      isValidating = false;
    }
  }

  // Check camera availability
  async function checkCameraAvailability() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      hasCamera = devices.some(device => device.kind === "videoinput");
    } catch (err) {
      hasCamera = false;
    }
  }

  // Initialize
  onMount(() => {
    checkCameraAvailability();
    loadTokenFee();
    refreshBalanceOnMount();
  });
</script>

<Modal
  isOpen={isOpen && !showConfirmation}
  onClose={handleClose}
  title="Send {token?.name || 'Token'}"
  width="480px"
  variant="transparent"
  height="auto"
  className={`send-token-modal ${closing ? "modal-closing" : ""}`}
  isPadded={true}
>
  <div class="flex flex-col gap-5 max-w-[480px] mx-auto">
    <!-- Token Info Banner -->
    {#if token}
      <div
        class="flex items-center gap-3 p-3 rounded-lg bg-kong-bg-tertiary border border-kong-border/30 transition-all duration-300 shadow-sm"
        style="opacity: {closing ? 0 : mounted ? 1 : 0}; transform: translateY({closing ? '-10px' : mounted ? 0 : '10px'});"
      >
        <div class="w-12 h-12 rounded-full bg-kong-bg-secondary p-1 border border-kong-border/20 flex-shrink-0 flex items-center justify-center shadow-inner-white">
          <TokenImages tokens={[token]} size={36} showSymbolFallback={true} />
        </div>
        <div class="flex flex-col">
          <div class="text-kong-text-primary font-medium text-lg">{token.name}</div>
          <div class="text-sm text-kong-text-secondary">
            <div class="flex flex-col justify-center">
              <span class="font-medium">{formatBalance(currentBalance, token.decimals)} {token.symbol}</span>
              {#if token.metrics?.price && currentBalanceUsd}
                <span class="font-medium text-xss">${formatUsdValue(String(currentBalanceUsd))}</span>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {:else}
      <div class="h-[68px] bg-kong-bg-secondary/10 border border-kong-border/30 rounded-lg animate-pulse"></div>
    {/if}

    <!-- Send Form -->
    {#if token}
      <form
        onsubmit={handleSubmit}
        class="flex flex-col gap-4 transition-all duration-300"
        style="opacity: {closing ? 0 : mounted ? 1 : 0}; transform: translateY({closing ? '-10px' : mounted ? 0 : '20px'}); transition-delay: {closing ? '0ms' : '100ms'};"
      >
        <!-- Address Input Section -->
        <div class="flex flex-col">
          <label for="recipient-address" class="block text-sm text-kong-text-primary font-medium mb-1.5 flex justify-between">
            <span>Recipient Address</span>
            {#if recipientAddress && !addressValidation.isValid && addressValidation.errorMessage}
              <span class="text-kong-error text-xs">{addressValidation.errorMessage}</span>
            {/if}
          </label>
          <div class="relative">
            <input
              id="recipient-address"
              type="text"
              class={`w-full py-4 px-3 bg-kong-bg-secondary/30 border ${
                addressFocused ? 'border-kong-primary ring-1 ring-kong-primary/20' :
                addressValidation.isValid ? 'border-kong-primary/40' :
                recipientAddress ? 'border-kong-error/40' : 'border-kong-border/50'
              } rounded-md text-lg text-kong-text-primary focus:outline-none transition-colors duration-150`}
              placeholder="Enter recipient address"
              bind:value={recipientAddress}
              oninput={handleAddressInput}
              onfocus={() => addressFocused = true}
              onblur={() => addressFocused = false}
            />
            <div class="absolute inset-y-0 right-0 flex items-center gap-0.5">
              {#if addressValidation.isValid}
                <div class="p-1.5 text-kong-success">
                  <Check size={16} />
                </div>
              {/if}
              <button
                type="button"
                class="p-2 text-kong-text-secondary hover:text-kong-text-primary transition-colors duration-150"
                onclick={handleAddressPaste}
                use:tooltip={{ text: "Paste from clipboard", direction: "top" }}
              >
                <Clipboard size={16} />
              </button>
              {#if hasCamera}
                <button
                  type="button"
                  class="p-2 text-kong-text-secondary hover:text-kong-text-primary transition-colors duration-150"
                  onclick={handleScanClick}
                  use:tooltip={{ text: "Scan QR code", direction: "top" }}
                >
                  <Camera size={16} />
                </button>
              {/if}
            </div>
          </div>
          
          {#if addressValidation.addressType && addressValidation.isValid}
            <div class="mt-1.5 text-xs text-kong-success flex items-center gap-1">
              <Check size={12} />
              {addressValidation.addressType === 'icrc1' ? 'Valid ICRC-1 Account' : 
               addressValidation.addressType === 'principal' ? 'Valid Principal ID' : 'Valid ICP Account ID'}
            </div>
          {/if}
        </div>

        <!-- Amount Input Section -->
        <div class="flex flex-col">
          <div class="flex justify-between items-center mb-1.5">
            <label for="amount-input" class="block text-sm text-kong-text-primary font-medium">
              <span>Amount</span>
            </label>
            <button
              type="button"
              class="text-xs text-kong-primary hover:text-kong-primary/80 font-medium transition-colors duration-150 py-1 px-2 bg-kong-primary/5 rounded-full"
              onclick={handleSendMax}
            >
              Send Max
            </button>
          </div>
          
          {#if amountValidation.errorMessage && amount}
            <div class="text-kong-error text-xs flex items-start gap-1 mb-1.5">
              <AlertCircle size={12} class="mt-0.5 flex-shrink-0" />
              <span>{amountValidation.errorMessage}</span>
            </div>
          {/if}
          
          <div class="relative">
            <input
              id="amount-input"
              type="text"
              inputmode="decimal"
              class={`w-full py-4 px-3 bg-kong-bg-secondary/30 border ${
                amountFocused ? 'border-kong-primary ring-1 ring-kong-primary/20' :
                amountValidation.isValid ? 'border-kong-primary/40' :
                amount ? 'border-kong-error/40' : 'border-kong-border/50'
              } rounded-md text-lg text-kong-text-primary focus:outline-none transition-colors duration-150`}
              placeholder="0.00"
              bind:value={amount}
              oninput={handleAmountInput}
              onfocus={() => amountFocused = true}
              onblur={() => amountFocused = false}
            />
            <div class="absolute inset-y-0 right-0 flex items-center pr-3">
              <div class="flex flex-col items-end">
                <span class="text-kong-text-secondary font-medium">{token.symbol}</span>
                {#if usdValue !== "0.00" && amount}
                  <div class="flex items-center gap-0.5 text-xs text-kong-primary/90">
                    <span>${formatUsdValue(usdValue)}</span>
                  </div>
                {/if}
              </div>
            </div>
          </div>
          
          <div class="flex justify-between items-center text-xs mt-1.5">
            <div class="text-kong-text-secondary">
              Max: <span class="font-medium">{maxAmount} {token.symbol}</span>
            </div>
            <div class="flex items-center gap-1 text-kong-text-secondary/70 bg-kong-bg-secondary/30 px-2 py-1 rounded-full">
              <Info size={12} />
              <span>Fee: {tokenFee ? formatBalance(tokenFee, token.decimals) : "..."} {token.symbol}</span>
            </div>
          </div>
        </div>
        
        <!-- Submit Button -->
        <ButtonV2
          theme="primary"
          variant="solid"
          size="lg"
          fullWidth={true}
          isDisabled={!isFormValid || isValidating}
          type="submit"
          className={`mt-2 ${!isFormValid || isValidating ? '!bg-kong-bg-secondary !text-kong-text-primary border-0' : ''}`}
        >
          <div class="flex items-center justify-center gap-2">
            {#if isValidating}
              <div class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              <span>Processing...</span>
            {:else}
              <ScrollText size={16} />
              <span>Review Transfer</span>
            {/if}
          </div>
        </ButtonV2>
      </form>
    {:else}
      <!-- Placeholder for form while token loads -->
      <div class="flex flex-col gap-4">
        <div class="h-[58px] bg-kong-bg-secondary/10 border border-kong-border/30 rounded-lg animate-pulse"></div>
        <div class="h-[80px] bg-kong-bg-secondary/10 border border-kong-border/30 rounded-lg animate-pulse"></div>
        <div class="h-[48px] bg-kong-bg-secondary/10 border border-kong-border/30 rounded-lg animate-pulse mt-2"></div>
      </div>
    {/if}
  </div>
</Modal>

<!-- QR Scanner Modal -->
{#if showScanner}
  <QrScanner isOpen={showScanner} onClose={() => (showScanner = false)} onScan={handleScan} />
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
    {isValidating}
    toPrincipal={transferDetails.toPrincipal}
  />
{/if}

<style scoped>
  :global(.send-token-modal) { animation: fadeIn 0.25s ease-out; }
  :global(.modal-closing) { animation: fadeOut 0.2s ease-out forwards !important; }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes fadeOut {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(20px); }
  }

  @media (max-width: 640px) {
    :global(.send-token-modal .modal-content) {
      padding: 0 8px;
    }

    :global(.send-token-modal input) {
      font-size: 1rem;
    }
  }
</style>
