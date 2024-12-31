<script lang="ts">
  import { IcrcService } from "$lib/services/icrc/IcrcService";
  import { toastStore } from "$lib/stores/toastStore";
  import Modal from "$lib/components/common/Modal.svelte";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import QrScanner from "$lib/components/common/QrScanner.svelte";
  import { onMount } from "svelte";
  import { Clipboard } from "lucide-svelte";
  import { Camera } from "lucide-svelte";
  import { auth } from "$lib/services/auth";
  import {  detectAddressType, validateAddress } from "$lib/utils/balanceUtils";
  import { getAccountIds, getPrincipalString } from "$lib/utils/accountUtils";
  import {
    calculateMaxAmount,
    validateTokenAmount,
    getInitialBalances,
  } from "$lib/utils/tokenValidationUtils";
  import {
    formatTokenInput,
    convertToTokenAmount
  } from "$lib/utils/tokenConversionUtils";

  export let token: FE.Token;

  let recipientAddress = "";
  let amount = "";
  let isValidating = false;
  let errorMessage = "";
  let tokenFee: bigint;
  let showScanner = false;
  let hasCamera = false;
  let selectedAccount: "subaccount" | "main" = "main";
  let accounts = {
    subaccount: "",
    main: "",
  };

  let balances = getInitialBalances(token?.symbol);

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

  let addressType: "principal" | "account" | null = null;
  let showConfirmation = false;

  function validateRecipientAddress(address: string): boolean {
    const validation = validateAddress(address);
    addressType = detectAddressType(address.trim());
    errorMessage = validation.errorMessage;
    return validation.isValid;
  }

  function validateAmount(value: string): boolean {
    const currentBalance = selectedAccount === "main" ? balances.default : balances.subaccount;
    const { isValid, errorMessage: errMsg } = validateTokenAmount(
      value,
      currentBalance,
      token.decimals,
      tokenFee
    );
    errorMessage = errMsg;
    return isValid;
  }

  function handleAmountInput(event: Event) {
    const input = event.target as HTMLInputElement;
    amount = formatTokenInput(input.value, token.decimals);
    errorMessage = "";
    validateAmount(amount);
  }

  async function handleSubmit() {
    showConfirmation = true;
  }

  $: if (auth.pnp?.account?.owner) {
    const principal = auth.pnp.account.owner;
    const principalStr = getPrincipalString(principal);
    accounts = getAccountIds(principalStr, auth.pnp?.account?.subaccount);
  }

  async function confirmTransfer() {
    isValidating = true;
    errorMessage = "";
    showConfirmation = false;

    try {
      const decimals = token.decimals || 8;
      const amountBigInt = convertToTokenAmount(amount, decimals);

      toastStore.info(`Sending ${token.symbol}...`);

      // Get the correct subaccount based on selection
      const fromSubaccount =
        selectedAccount === "subaccount"
          ? auth.pnp?.account?.subaccount
          : undefined;

      let result;
      if (addressType === "account") {
        result = await IcrcService.icrc1Transfer(
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
      } else {
        result = await IcrcService.icrc1Transfer(
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
      }

      if (result?.Ok) {
        toastStore.success(`Successfully sent ${token.symbol}`);
        recipientAddress = "";
        amount = "";
        // Reload balances after successful transfer
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
    amount = maxAmount.toFixed(token.decimals);
    errorMessage = "";
  }

  $: {
    if (recipientAddress) {
      validateRecipientAddress(recipientAddress);
    } else {
      addressType = null;
      errorMessage = "";
    }
  }

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
    if (addressType === "principal")
      return {
        type: "success",
        text: "Valid Principal ID",
      };
    if (addressType === "account")
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
    console.log("Scanned text:", cleanedText);

    if (validateRecipientAddress(cleanedText)) {
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
  });

  async function loadBalances() {
    try {
      if (!auth.pnp?.account?.owner || !token) return;

      if (token.symbol === "ICP") {
        const result = await IcrcService.getIcrc1Balance(
          token,
          auth.pnp.account.owner,
          auth.pnp?.account?.subaccount
            ? Array.from(auth.pnp.account.subaccount)
            : undefined,
          true,
        );

        if (typeof result === "object" && "default" in result) {
          balances = result;
        } else {
          balances = {
            default: result as bigint,
            subaccount: BigInt(0),
          };
        }
      } else {
        const result = await IcrcService.getIcrc1Balance(
          token,
          auth.pnp.account.owner,
          undefined,
          false,
        );
        balances = {
          default: result as bigint,
        };
      }
    } catch (error) {
      console.error("Error loading balances:", error);
      balances =
        token.symbol === "ICP"
          ? { default: BigInt(0), subaccount: BigInt(0) }
          : { default: BigInt(0) };
    }
  }

  $: if (token && auth.pnp?.account?.owner) {
    loadBalances();
  }

  $: if (selectedAccount) {
    loadBalances();
  }
</script>

<div class="container">
  <form on:submit|preventDefault={handleSubmit}>
    {#if token.symbol === "ICP"}
      <div class="card">
        <div class="card-header">
          <span>Source Account</span>
        </div>
        <select bind:value={selectedAccount} class="select-input">
          <option value="subaccount">
            Subaccount ({accounts.subaccount.slice(0, 6)}...{accounts.subaccount.slice(-6)})
          </option>
          <option value="main">
            Main Account ({accounts.main.slice(0, 6)}...{accounts.main.slice(-6)})
          </option>
        </select>
      </div>
    {/if}

    <div class="card">
      <div class="card-header">
        <span>Recipient Address</span>
        <div class="header-actions">
          {#if hasCamera}
            <button
              type="button"
              class="icon-button"
              on:click={() => (showScanner = true)}
              title="Scan QR Code"
            >
              <Camera class="w-4 h-4" />
            </button>
          {/if}
          <button
            type="button"
            class="icon-button"
            on:click={recipientAddress ? () => (recipientAddress = "") : handlePaste}
          >
            {#if recipientAddress}
              <span class="text-lg">✕</span>
            {:else}
              <Clipboard class="w-4 h-4" />
            {/if}
          </button>
        </div>
      </div>

      <input
        type="text"
        bind:value={recipientAddress}
        placeholder="Paste address or enter manually"
        class="text-input"
        class:error={errorMessage && recipientAddress}
        class:success={addressType === "principal" && !errorMessage}
      />

      {#if recipientAddress}
        <div 
          class="validation-message"
          class:success={validationMessage.type === "success"}
          class:error={validationMessage.type === "error"}
        >
          {validationMessage.text}
        </div>
      {/if}
    </div>

    <div class="card">
      <div class="card-header">
        <span>Amount</span>
        <button type="button" class="max-button" on:click={setMaxAmount}>MAX</button>
      </div>

      <input
        type="text"
        inputmode="decimal"
        placeholder="Enter amount"
        bind:value={amount}
        on:input={handleAmountInput}
        class="text-input"
        class:error={errorMessage.includes("balance") || errorMessage.includes("Amount")}
      />

      <div class="balance-container">
        {#if token.symbol === "ICP"}
          <div class="balance-row">
            <span>Default Account</span>
            <span>{formatBalance(balances.default, token.decimals)} {token.symbol}</span>
          </div>
          <div class="balance-row">
            <span>Subaccount</span>
            <span>{formatBalance(balances.subaccount, token.decimals)} {token.symbol}</span>
          </div>
          <div class="balance-row total">
            <span>Selected Balance</span>
            <span>
              {formatBalance(
                selectedAccount === "main" ? balances.default : balances.subaccount,
                token.decimals
              )} {token.symbol}
            </span>
          </div>
        {:else}
          <div class="balance-row total">
            <span>Available Balance</span>
            <span>{formatBalance(balances.default, token.decimals)} {token.symbol}</span>
          </div>
        {/if}
      </div>
    </div>

    {#if errorMessage}
      <div class="error-banner">
        {errorMessage}
      </div>
    {/if}

    <button
      type="submit"
      class="submit-button"
      disabled={isValidating || !amount || !recipientAddress || addressType === "account"}
    >
      {#if addressType === "account"}
        Sending to Account IDs coming soon
      {:else}
        Send Tokens
      {/if}
    </button>
  </form>

  {#if showConfirmation}
    <Modal
      isOpen={showConfirmation}
      onClose={() => (showConfirmation = false)}
      title="Confirm Your Transfer"
      width="min(450px, 95vw)"
      height="auto"
      variant="solid"
    >
      <div class="confirm-modal">
        <div class="transfer-summary">
          <div class="amount-display">
            <span class="amount">{amount}</span>
            <span class="symbol">{token.symbol}</span>
          </div>
        </div>

        <div class="details-grid">
          <div class="detail-row">
            <span class="label">You Send</span>
            <span class="value">{amount} {token.symbol}</span>
          </div>
          <div class="detail-row">
            <span class="label">Network Fee</span>
            <span class="value">
              {formatBalance(tokenFee?.toString() || "10000", token.decimals)}
              {token.symbol}
            </span>
          </div>
          <div class="detail-row">
            <span class="label">Receiver Gets</span>
            <span class="value">
              {parseFloat(amount).toFixed(token.decimals)}
              {token.symbol}
            </span>
          </div>
          <div class="detail-row total">
            <span class="label">Total Amount</span>
            <span class="value">
              {(parseFloat(amount) + parseFloat(tokenFee?.toString() || "10000") / 10 ** token.decimals).toFixed(4)}
              {token.symbol}
            </span>
          </div>
        </div>

        <div class="modal-actions">
          <button 
            class="cancel-button" 
            on:click={() => (showConfirmation = false)}
          >
            Cancel
          </button>
          <button
            class="confirm-button"
            class:loading={isValidating}
            on:click={confirmTransfer}
            disabled={isValidating}
          >
            {#if isValidating}
              <span class="loading-spinner" />
              Processing...
            {:else}
              Confirm Transfer
            {/if}
          </button>
        </div>
      </div>
    </Modal>
  {/if}

  {#if showScanner}
    <Modal
      isOpen={showScanner}
      onClose={() => (showScanner = false)}
      title="Scan QR Code"
      width="min(450px, 95vw)"
      height="auto"
      variant="solid"
    >
      <div class="scanner-modal">
        <div class="scanner-container">
          <QrScanner
            onScan={handleScan}
            onClose={() => (showScanner = false)}
          />
        </div>
        <p class="scanner-help">
          Position the QR code within the frame to scan
        </p>
        <button 
          class="cancel-button w-full" 
          on:click={() => (showScanner = false)}
        >
          Cancel Scan
        </button>
      </div>
    </Modal>
  {/if}
</div>

<style scoped lang="postcss">
  .container {
    @apply flex flex-col gap-4 p-4 pt-0;
  }

  .card {
    @apply bg-kong-bg-light rounded-md px-4 py-3 mt-4
           border border-kong-border/10 hover:border-kong-border
           transition-all duration-200;
  }

  .card-header {
    @apply flex justify-between items-center mb-3 
           text-kong-text-primary font-medium;
  }

  .header-actions {
    @apply flex items-center gap-2;
  }

  .icon-button {
    @apply p-2 rounded-lg bg-kong-bg-dark 
           text-kong-text-secondary hover:text-kong-text-primary
           hover:bg-kong-bg-dark transition-colors
           active:scale-95 duration-150;
  }

  .text-input {
    @apply w-full px-4 py-3 bg-kong-bg-dark rounded-lg
           text-kong-text-primary placeholder:text-kong-text-secondary/50
           border border-kong-border/10 hover:border-kong-border
           focus:border-kong-primary focus:ring-1 focus:ring-kong-primary/20
           focus:outline-none transition-all duration-200;

    &.error {
      @apply border-kong-error/50 bg-kong-error/5 
             focus:border-kong-error focus:ring-kong-error/20;
    }

    &.success {
      @apply border-kong-success/50 bg-kong-success/5
             focus:border-kong-success focus:ring-kong-success/20;
    }
  }

  .select-input {
    @apply w-full px-4 py-3 bg-kong-bg-dark rounded-lg
           text-kong-text-primary border border-kong-border/10
           hover:border-kong-border focus:border-kong-primary
           focus:ring-1 focus:ring-kong-primary/20 focus:outline-none
           transition-all duration-200;
  }

  .validation-message {
    @apply mt-2 px-1 text-sm;
    &.success { @apply text-kong-success; }
    &.error { @apply text-kong-error; }
  }

  .max-button {
    @apply px-3 py-1.5 text-sm font-medium rounded-lg
           bg-kong-primary/10 text-kong-primary
           hover:bg-kong-primary/20 active:scale-95
           transition-all duration-200;
  }

  .balance-container {
    @apply mt-3 space-y-1.5 text-sm;
  }

  .balance-row {
    @apply flex justify-between items-center text-kong-text-secondary;

    &.total {
      @apply mt-3 pt-3 border-t border-kong-border/10
             text-kong-text-primary font-medium;
    }
  }

  .error-banner {
    @apply p-3 rounded-lg bg-kong-error/10 text-kong-error
           text-sm border border-kong-error/20;
  }

  .submit-button {
    @apply w-full py-3.5 mt-2 bg-kong-primary text-white rounded-lg
           font-medium hover:bg-kong-primary-hover active:scale-[0.99]
           disabled:opacity-50 disabled:cursor-not-allowed
           disabled:hover:bg-kong-primary disabled:active:scale-100
           transition-all duration-200;
  }

  /* Modal Styles */
  .confirm-modal {
    @apply p-6 flex flex-col gap-6;
  }

  .transfer-summary {
    @apply text-center;
  }

  .amount-display {
    @apply flex items-baseline justify-center gap-2;

    .amount {
      @apply text-3xl font-bold text-kong-text-primary;
    }

    .symbol {
      @apply text-lg text-kong-text-secondary;
    }
  }

  .details-grid {
    @apply space-y-2;
  }

  .detail-row {
    @apply flex justify-between items-center p-3 
           bg-kong-bg-dark rounded-lg
           border border-kong-border/10;

    .label {
      @apply text-sm text-kong-text-secondary;
    }

    .value {
      @apply text-sm text-kong-text-primary font-medium;
    }

    &.total {
      @apply mt-4 bg-kong-bg-dark/60 border-kong-border;
      
      .label {
        @apply font-medium text-kong-text-primary;
      }
      
      .value {
        @apply font-medium text-kong-text-primary;
      }
    }
  }

  .modal-actions {
    @apply flex gap-3 pt-4 border-t border-kong-border/10;
  }

  .cancel-button {
    @apply flex-1 py-3 rounded-lg font-medium
           bg-kong-bg-dark/60 hover:bg-kong-bg-dark/80
           text-kong-text-secondary border border-kong-border/10
           transition-all duration-200 text-sm;
  }

  .confirm-button {
    @apply flex-1 py-3 rounded-lg font-medium
           bg-kong-primary hover:bg-kong-primary-hover
           text-white disabled:opacity-50 disabled:cursor-not-allowed
           transition-all duration-200 text-sm
           flex items-center justify-center gap-2;

    &.loading {
      @apply bg-kong-primary/70;
    }
  }

  .loading-spinner {
    @apply inline-block h-4 w-4 border-2 
           border-white/30 border-t-white rounded-full
           animate-spin;
  }

  /* Scanner Modal Styles */
  .scanner-modal {
    @apply p-6 flex flex-col gap-4;
  }

  .scanner-container {
    @apply bg-kong-bg-dark rounded-lg
           border border-kong-border/10;

    :global(video) {
      @apply rounded-lg;
    }
  }

  .scanner-help {
    @apply text-center text-sm text-kong-text-secondary;
  }
</style>
