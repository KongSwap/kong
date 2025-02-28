<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { IcrcService } from "$lib/services/icrc/IcrcService";
  import { toastStore } from "$lib/stores/toastStore";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import BigNumber from "bignumber.js";
  import QrScanner from "$lib/components/common/QrScanner.svelte";
  import { onMount } from "svelte";
  import { Clipboard, Camera, ArrowRight, Info, X, Check } from "lucide-svelte";
  import { auth } from "$lib/services/auth";
  import { tooltip } from "$lib/actions/tooltip";
  import { fly, fade } from "svelte/transition";
  import { getAccountIds } from "$lib/utils/accountUtils";
  import { 
    calculateMaxAmount, 
    validateTokenAmount, 
    validateAddress, 
    formatTokenInput,
    getInitialBalances,
  } from "$lib/utils/validators/tokenValidators";

  export let token: FE.Token;

  let recipientAddress = "";
  let amount = "";
  let isValidating = false;
  let errorMessage = "";
  let tokenFee: bigint;
  let showScanner = false;
  let hasCamera = false;
  let selectedAccount: "main" | "subaccount" = "main";
  let accounts = {
    subaccount: "",
    main: "",
  };

  let balances: TokenBalances = getInitialBalances(token?.symbol);
  let addressValidation = { isValid: false, errorMessage: "", addressType: null };
  let amountValidation = { isValid: false, errorMessage: "" };

  const dispatch = createEventDispatcher();

  async function loadTokenFee() {
    try {
      tokenFee = await IcrcService.getTokenFee(token);
    } catch (error) {
      console.error("Error loading token fee:", error);
      tokenFee = BigInt(10000); // Fallback to default fee
    }
  }

  $: if (token) {
    loadTokenFee();
  }

  $: maxAmount = token?.symbol === "ICP"
      ? calculateMaxAmount(
          selectedAccount === "main" ? balances.default : balances.subaccount,
          token.decimals,
          tokenFee
        )
      : calculateMaxAmount(balances.default, token.decimals, tokenFee);
      
  let showConfirmation = false;

  function handleAmountInput(event: Event) {
    const input = event.target as HTMLInputElement;
    amount = formatTokenInput(input.value, token.decimals);
    
    const currentBalance = selectedAccount === "main" ? balances.default : balances.subaccount;
    amountValidation = validateTokenAmount(amount, currentBalance, token.decimals, tokenFee);
    errorMessage = amountValidation.errorMessage;
  }

  async function handleSubmit() {
    dispatch("confirmTransfer", {
      amount,
      token,
      tokenFee,
      isValidating,
      toPrincipal: recipientAddress,
    });
  }

  $: if (auth.pnp?.account?.owner) {
    const principal = auth.pnp.account.owner;
    const principalStr =
      typeof principal === "string" ? principal : principal?.toText?.() || "";
    accounts = getAccountIds(principalStr, auth.pnp?.account?.subaccount);
  }

  async function confirmTransfer() {
    isValidating = true;
    errorMessage = "";
    showConfirmation = false;

    try {
      const decimals = token.decimals || 8;
      const amountBigInt = BigInt(
        new BigNumber(amount).times(new BigNumber(10).pow(decimals)).toString(),
      );

      toastStore.info(`Sending ${amount} ${token.symbol}...`);

      const fromSubaccount =
        selectedAccount === "subaccount"
          ? auth.pnp?.account?.subaccount
          : undefined;

      const result = await IcrcService.transfer(
        token,
        recipientAddress,
        amountBigInt,
        {
          fee: BigInt(token.fee_fixed),
          fromSubaccount: fromSubaccount
            ? Array.from(fromSubaccount)
            : undefined,
        },
      );

      if (result?.Ok) {
        toastStore.success(`Successfully sent ${token.symbol}`);
        recipientAddress = "";
        amount = "";
        dispatch("close");
        await loadBalances();
      } else if (result?.Err) {
        const errMsg =
          typeof result.Err === "object"
            ? Object.keys(result.Err)[0]
            : String(result.Err);
        errorMessage = `Transfer failed: ${errMsg}`;
        toastStore.error(errorMessage);
      }
    } catch (err) {
      errorMessage = err.message || "Transfer failed";
      toastStore.error(errorMessage);
    } finally {
      isValidating = false;
    }
  }

  function setMaxAmount() {
    if (maxAmount <= 0) {
      toastStore.warning(
        "Hmm... Looks like you don't have enough balance for a transfer",
      );
      return;
    }
    amount = maxAmount.toFixed(token.decimals);
    
    const currentBalance = selectedAccount === "main" ? balances.default : balances.subaccount;
    amountValidation = validateTokenAmount(amount, currentBalance, token.decimals, tokenFee);
    errorMessage = amountValidation.errorMessage;
  }

  $: if (recipientAddress) {
    addressValidation = validateAddress(recipientAddress, token.symbol, token.name);
    errorMessage = addressValidation.errorMessage;
  } else {
    addressValidation = { isValid: false, errorMessage: "", addressType: null };
    if (!amount) errorMessage = "";
  }

  $: if (amount) {
    const currentBalance = selectedAccount === "main" ? balances.default : balances.subaccount;
    amountValidation = validateTokenAmount(amount, currentBalance, token.decimals, tokenFee);
    if (!addressValidation.errorMessage) errorMessage = amountValidation.errorMessage;
  } else {
    amountValidation = { isValid: false, errorMessage: "" };
    if (!addressValidation.errorMessage) errorMessage = "";
  }

  $: isFormValid =
    amount &&
    recipientAddress &&
    !errorMessage &&
    addressValidation.addressType !== null &&
    addressValidation.isValid &&
    amountValidation.isValid;

  $: validationMessage = (() => {
    if (!recipientAddress)
      return {
        type: "info",
        text: "Enter a Principal ID or Account ID",
      };
    if (errorMessage)
      return {
        type: "error",
        text: errorMessage,
      };
    if (addressValidation.addressType === "principal")
      return {
        type: "success",
        text: "Valid Principal ID",
      };
    if (addressValidation.addressType === "account")
      return {
        type: "success",
        text: "Valid Account ID",
      };
    return {
      type: "error",
      text: "Invalid address format",
    };
  })();

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      recipientAddress = text.trim();
    } catch (err) {
      toastStore.error("Failed to paste from clipboard");
    }
  }

  function handleScan(scannedText: string) {
    const cleanedText = scannedText.trim();
    const validation = validateAddress(cleanedText, token.symbol, token.name);

    if (validation.isValid) {
      recipientAddress = cleanedText;
      toastStore.success("QR code scanned successfully");
      showScanner = false;
    } else {
      toastStore.error(
        "Invalid QR code. Please scan a valid Principal ID or Account ID",
      );
    }
  }

  async function checkCameraAvailability() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      hasCamera = devices.some((device) => device.kind === "videoinput");
    } catch (err) {
      console.debug("Error checking camera:", err);
      hasCamera = false;
    }
  }

  onMount(() => {
    checkCameraAvailability();
    document.addEventListener("confirmTransfer", confirmTransfer);
    return () => {
      document.removeEventListener("confirmTransfer", confirmTransfer);
    };
  });

  async function loadBalances() {
    try {
      if (token?.symbol === "ICP") {
        const result: any = await IcrcService.getIcrc1Balance(
          token,
          auth.pnp?.account?.owner,
          auth.pnp?.account?.subaccount
            ? Array.from(auth.pnp.account.subaccount)
            : undefined,
          true,
        );

        balances = {
          default: result.default || BigInt(0),
          subaccount: result.subaccount || BigInt(0),
        };

        // Update token object with both balances
        token = {
          ...token,
          balance: balances.default.toString(),
        };
      } else {
        // For non-ICP tokens, just get the main balance
        const result = await IcrcService.getIcrc1Balance(
          token,
          auth.pnp?.account?.owner,
          undefined,
          false,
        );
        balances = {
          default: typeof result === "bigint" ? result : BigInt(0),
        };
      }
    } catch (error) {
      console.error("Error loading balances:", error);
      balances = getInitialBalances(token?.symbol);
    }
  }

  $: if (selectedAccount) {
    loadBalances();
  }

  function getTooltipMessage(): string {
    if (!recipientAddress) {
      return "Enter a recipient address";
    }
    if (recipientAddress && !addressValidation.isValid) {
      return addressValidation.errorMessage || "Invalid address format";
    }
    if (!amount) {
      return "Enter an amount";
    }
    if (amount && !amountValidation.isValid) {
      return amountValidation.errorMessage || "Invalid amount";
    }
    if (errorMessage) {
      return errorMessage;
    }
    return "";
  }

  function getFeeDisplay() {
    if (!tokenFee) return "Loading...";
    return `${new BigNumber(tokenFee.toString()).dividedBy(new BigNumber(10).pow(token.decimals))} ${token.symbol}`;
  }
</script>

<div class="container pb-6 px-4" in:fade={{ duration: 200 }}>
  <form on:submit|preventDefault={handleSubmit}>
    <!-- Token Info Banner -->
    <div class="token-info-banner">
      <div class="token-logo">
        <img src={token.logo_url} alt={token.symbol} width="32" height="32" />
      </div>
      <div class="token-details">
        <span class="token-name">{token.name}</span>
        <span class="token-balance">
          Balance: {formatBalance(
            selectedAccount === "main"
              ? balances.default.toString()
              : (balances.subaccount?.toString() ?? "0"),
            token.decimals,
          )}
          {token.symbol}
        </span>
      </div>
    </div>

    <!-- Recipient Address Section -->
    <div class="card-section">
      <div class="section-header">
        <span class="section-title">Recipient Address</span>
        <div class="header-actions">
          {#if hasCamera}
            <button
              type="button"
              class="action-button"
              on:click={() => (showScanner = true)}
              title="Scan QR Code"
            >
              <Camera class="w-4 h-4" />
              <span class="button-text">Scan QR</span>
            </button>
          {/if}
          <button
            type="button"
            class="action-button"
            on:click={recipientAddress
              ? () => (recipientAddress = "")
              : handlePaste}
          >
            {#if recipientAddress}
              <X class="w-4 h-4" />
              <span class="button-text">Clear</span>
            {:else}
              <Clipboard class="w-4 h-4" />
              <span class="button-text">Paste</span>
            {/if}
          </button>
        </div>
      </div>
      <div class="input-group">
        <div class="input-wrapper">
          <input
            type="text"
            bind:value={recipientAddress}
            placeholder="Paste address or enter manually"
            class:error={errorMessage && recipientAddress}
            class:valid={addressValidation.addressType !== null && !errorMessage}
          />
        </div>

        {#if recipientAddress}
          <div
            class="validation-status"
            class:success={validationMessage.type === "success"}
            class:error={validationMessage.type === "error"}
            in:fly={{ y: -10, duration: 150 }}
          >
            <span class="status-icon">
              {#if validationMessage.type === "success"}
                <Check size={14} />
              {:else if validationMessage.type === "error"}
                <X size={14} />
              {:else}
                <Info size={14} />
              {/if}
            </span>
            <span class="status-text">{validationMessage.text}</span>
          </div>
        {/if}
      </div>
    </div>

    <!-- Amount Section -->
    <div class="card-section">
      <div class="section-header">
        <span class="section-title">Amount</span>
        <div class="header-actions">
          {#if token.symbol === "ICP" && balances.subaccount && balances.subaccount > BigInt(0)}
            <div class="account-tabs">
              <button
                type="button"
                class="tab-button"
                class:active={selectedAccount === "main"}
                on:click={() => (selectedAccount = "main")}
              >
                Main
              </button>
              <button
                type="button"
                class="tab-button"
                class:active={selectedAccount === "subaccount"}
                on:click={() => (selectedAccount = "subaccount")}
              >
                Sub
              </button>
            </div>
          {/if}
          <button type="button" class="action-button" on:click={setMaxAmount}>
            Max
          </button>
        </div>
      </div>

      <div class="input-group">
        <div class="input-wrapper">
          <input
            type="text"
            inputmode="decimal"
            placeholder="Enter amount"
            bind:value={amount}
            on:input={handleAmountInput}
            class:error={errorMessage.includes("balance") ||
              errorMessage.includes("Amount")}
          />
          <div class="balance-display">
            <div class="balance-info">
              <span>Available:</span>
              <span class="balance-value"
                >{formatBalance(
                  selectedAccount === "main"
                    ? balances.default.toString()
                    : (balances.subaccount?.toString() ?? "0"),
                  token.decimals,
                )}
                {token.symbol}</span
              >
            </div>
            <div class="fee-info">
              <span>Network Fee:</span>
              <span class="fee-value">{getFeeDisplay()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary Section (only shows when form is valid) -->
    {#if isFormValid}
      <div class="summary-section" in:fly={{ y: 20, duration: 200 }}>
        <div class="summary-header">Transaction Summary</div>
        <div class="summary-content">
          <div class="summary-row">
            <span>Sending</span>
            <span class="summary-value">{amount} {token.symbol}</span>
          </div>
          <div class="summary-row">
            <span>To</span>
            <span class="summary-value address-truncate"
              >{recipientAddress}</span
            >
          </div>
          <div class="summary-row">
            <span>Fee</span>
            <span class="summary-value">{getFeeDisplay()}</span>
          </div>
        </div>
      </div>
    {/if}

    <button
      type="submit"
      class="send-btn"
      class:disabled={!isFormValid || isValidating}
      class:error={errorMessage}
      disabled={!isFormValid || isValidating}
      use:tooltip={{
        text: getTooltipMessage(),
        direction: "top",
        background: errorMessage ? "bg-kong-accent-red" : "bg-kong-bg-dark",
      }}
    >
      {#if isValidating}
        <div class="spinner"></div>
        Processing...
      {:else}
        <ArrowRight class="w-5 h-5 mr-2" />
        Send {token.symbol}
      {/if}
    </button>
  </form>

  {#if showScanner}
    <QrScanner
      isOpen={showScanner}
      onClose={() => (showScanner = false)}
      onScan={handleScan}
    />
  {/if}
</div>

<style lang="postcss">
  .container {
    @apply flex flex-col gap-3 sm:gap-4;
  }

  .token-info-banner {
    @apply flex items-center gap-2 p-2.5 mb-2 rounded-lg
           bg-kong-surface-dark border border-kong-border/30
           transition-all duration-200
           sm:gap-3 sm:p-3;
  }

  .token-logo {
    @apply flex-shrink-0 rounded-full overflow-hidden
           bg-kong-bg-light p-1 border border-kong-border/20;
  }

  .token-logo img {
    @apply w-7 h-7 rounded-full object-contain
           sm:w-8 sm:h-8;
  }

  .token-details {
    @apply flex flex-col;
  }

  .token-name {
    @apply text-kong-text-primary font-medium;
  }

  .token-balance {
    @apply text-sm text-kong-text-secondary;
  }

  .card-section {
    @apply flex flex-col gap-2 mb-3 
           bg-kong-surface-dark/50 rounded-lg p-3
           border border-kong-border/20
           transition-all duration-200
           sm:mb-4 sm:p-4;
  }

  .section-header {
    @apply flex justify-between items-center mb-1;
  }

  .section-title {
    @apply text-kong-text-primary/90 text-sm font-medium;
  }

  .header-actions {
    @apply flex items-center gap-2;
  }

  .action-button {
    @apply px-3 rounded-lg py-1.5
           bg-kong-bg-light/50 border border-kong-border/10
           hover:bg-kong-bg-light hover:border-kong-border/30
           text-kong-text-primary/80 hover:text-kong-text-primary
           transition-all duration-200
           flex items-center justify-center gap-2;

    .button-text {
      @apply hidden md:inline text-sm;
    }

    &:active {
      @apply border-kong-primary bg-kong-primary/10 scale-98;
    }
  }

  .input-wrapper {
    @apply relative w-full;
  }

  .input-wrapper input {
    @apply w-full h-10 rounded-lg text-kong-text-primary px-3
           bg-kong-bg-light/70 backdrop-blur-sm
           border border-kong-border/50
           hover:border-kong-border
           focus:border-kong-primary focus:outline-none
           focus:ring-1 focus:ring-kong-primary/20
           transition-all duration-200
           sm:h-12 sm:px-4;

    &::placeholder {
      @apply text-kong-text-primary/30;
    }

    &.error {
      @apply border-kong-accent-red/70 bg-kong-accent-red/5
             focus:ring-kong-accent-red/20;
    }

    &.valid {
      @apply border-kong-accent-green/50 bg-kong-accent-green/5
             focus:ring-kong-accent-green/20;
    }
  }

  .validation-status {
    @apply flex items-center gap-1.5 text-xs mt-1.5 px-1
           sm:text-sm sm:mt-2;

    .status-icon {
      @apply flex items-center justify-center;
    }

    &.success {
      @apply text-kong-text-accent-green;
    }

    &.error {
      @apply text-kong-accent-red;
    }
  }

  .account-tabs {
    @apply flex gap-1 mr-2;
  }

  .tab-button {
    @apply px-2.5 py-1 rounded-lg text-xs
           bg-kong-bg-light/50 backdrop-blur-sm
           border border-kong-border/20
           text-kong-text-primary/70
           transition-all duration-200
           sm:px-3 sm:py-1.5 sm:text-sm;

    &.active {
      @apply bg-kong-primary/20 border-kong-primary/50 text-kong-text-primary;
    }
  }

  .balance-display {
    @apply flex flex-col gap-1 text-xs mt-2 px-1
           sm:text-sm sm:mt-3;
  }

  .balance-info,
  .fee-info {
    @apply flex justify-between items-center;
  }

  .balance-value {
    @apply text-kong-text-primary/90 font-medium;
  }

  .fee-value {
    @apply text-kong-text-secondary;
  }

  .summary-section {
    @apply bg-kong-primary/10 rounded-lg p-3 mb-3
           border border-kong-primary/20
           sm:p-4 sm:mb-4;
  }

  .summary-header {
    @apply text-xs font-medium text-kong-text-primary mb-2
           sm:text-sm sm:mb-3;
  }

  .summary-content {
    @apply flex flex-col gap-1.5
           sm:gap-2;
  }

  .summary-row {
    @apply flex justify-between items-center text-xs
           sm:text-sm;
  }

  .summary-value {
    @apply text-kong-text-primary font-medium;
  }

  .address-truncate {
    @apply truncate max-w-[200px];
  }

  .send-btn {
    @apply h-10 w-full rounded-lg font-medium
           flex items-center justify-center gap-1
           transition-all duration-200
           sm:h-12;

    &:not(.disabled):not(.error) {
      @apply bg-kong-primary text-white 
             hover:bg-kong-primary-hover
             active:scale-98;
    }

    &.disabled {
      @apply bg-kong-bg-light text-kong-text-primary/50 
             cursor-not-allowed border border-kong-border/20;
    }

    &.error {
      @apply bg-kong-accent-red text-white
             hover:bg-kong-accent-red/90;
    }
  }

  .spinner {
    @apply w-5 h-5 border-2 border-t-transparent border-white rounded-full mr-2;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
