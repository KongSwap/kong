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
    <div class="id-card">
      <div class="id-header">
        <span>Source Account</span>
      </div>
      <div class="input-group">
        <select bind:value={selectedAccount} class="account-select">
          <option value="subaccount"
            >Subaccount ({accounts.subaccount.slice(
              0,
              6,
            )}...{accounts.subaccount.slice(-6)})</option
          >
          <option value="main"
            >Main Account ({accounts.main.slice(0, 6)}...{accounts.main.slice(
              -6,
            )})</option
          >
        </select>
      </div>
    </div>
  {/if}
    <div class="id-card">
      <div class="id-header">
        <span>Recipient Address</span>
        <div class="header-actions">
          <button
            type="button"
            class="header-button"
            on:click={() => (showScanner = true)}
            title="Scan QR Code"
          >
            <Camera class="w-4 h-4" />
          </button>
          <button
            type="button"
            class="header-button"
            on:click={recipientAddress
              ? () => (recipientAddress = "")
              : handlePaste}
          >
            {#if recipientAddress}✕{:else}<Clipboard class="w-4 h-4" />
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
            class="ring-1 ring-kong-border"
            class:error={errorMessage && recipientAddress}
            class:valid={addressType === "principal" && !errorMessage}
          />
        </div>

        {#if recipientAddress}
          <div
            class="validation-status"
            class:success={validationMessage.type === "success"}
            class:error={validationMessage.type === "error"}
          >
            <span class="status-text">{validationMessage.text}</span>
          </div>
        {/if}
      </div>
    </div>

    <div class="id-card">
      <div class="id-header">
        <span>Amount</span>
        <button type="button" class="header-button" on:click={setMaxAmount}
          >MAX</button
        >
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
        </div>
        <div class="balance-info">
          {#if token.symbol === "ICP"}
            <div class="balance-row">
              <span>Default Account:</span>
              <span
                >{formatBalance(balances.default, token.decimals)}
                {token.symbol}</span
              >
            </div>
            <div class="balance-row">
              <span>Subaccount:</span>
              <span
                >{formatBalance(balances.subaccount, token.decimals)}
                {token.symbol}</span
              >
            </div>
            <div class="balance-row total">
              <span>Selected Balance:</span>
              <span
                >{formatBalance(
                  selectedAccount === "main"
                    ? balances.default
                    : balances.subaccount,
                  token.decimals,
                )}
                {token.symbol}</span
              >
            </div>
          {:else}
            <div class="balance-row total">
              <span>Available Balance:</span>
              <span
                >{formatBalance(balances.default, token.decimals)}
                {token.symbol}</span
              >
            </div>
          {/if}
        </div>
      </div>
    </div>

    {#if errorMessage}
      <div class="error-message">
        {errorMessage}
      </div>
    {/if}

    <button
      type="submit"
      class="send-btn"
      disabled={isValidating ||
        !amount ||
        !recipientAddress ||
        addressType === "account"}
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
    >
      <div class="confirm-box">
        <div class="confirm-details">
          <div class="transfer-summary">
            <div class="amount-display">
              <span class="amount">{amount}</span>
              <span class="symbol">{token.symbol}</span>
            </div>
          </div>

          <div class="details-grid">
            <div class="detail-item">
              <span class="label">You Send</span>
              <span class="value">{amount} {token.symbol}</span>
            </div>
            <div class="detail-item">
              <span class="label">Network Fee</span>
              <span class="value"
                >{formatBalance(
                  tokenFee?.toString() || "10000",
                  token.decimals,
                )}
                {token.symbol}</span
              >
            </div>
            <div class="detail-item">
              <span class="label">Receiver Gets</span>
              <span class="value"
                >{parseFloat(amount).toFixed(token.decimals)}
                {token.symbol}</span
              >
            </div>
            <div class="detail-item total">
              <span class="label">Total Amount</span>
              <span class="value"
                >{(
                  parseFloat(amount) +
                  parseFloat(tokenFee?.toString() || "10000") /
                    10 ** token.decimals
                ).toFixed(4)}
                {token.symbol}</span
              >
            </div>
          </div>
        </div>

        <div class="confirm-actions">
          <button class="cancel-btn" on:click={() => (showConfirmation = false)}
            >Cancel</button
          >
          <button
            class="confirm-btn"
            class:loading={isValidating}
            on:click={confirmTransfer}
            disabled={isValidating}
          >
            {#if isValidating}
              <span class="loading-spinner"></span>
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
    <QrScanner
      isOpen={showScanner}
      onClose={() => (showScanner = false)}
      onScan={handleScan}
    />
  {/if}
</div>

<style lang="postcss">
  .container {
    @apply flex flex-col gap-4 py-4 px-2;
  }

  .id-card {
    @apply bg-kong-bg-dark/50 rounded-xl p-4 mb-2 
           border border-white/5 hover:border-white/10 
           transition-colors;
  }

  .id-header {
    @apply flex justify-between items-center mb-3 
           text-kong-text-primary text-sm font-medium;
  }

  .header-actions {
    @apply flex items-center gap-2;
  }

  .header-button {
    @apply px-2.5 py-1.5 bg-black/20 rounded-lg 
           text-kong-text-primary/80 hover:text-kong-text-primary
           hover:bg-black/30 active:bg-black/40;
  }

  .input-wrapper {
    @apply relative flex items-center;

    input {
      @apply w-full px-3 py-2.5 bg-black/20 rounded-lg 
             text-kong-text-primary placeholder:text-kong-text-primary/30
             border border-white/5 hover:border-white/10
             focus:border-kong-primary focus:outline-none;

      &.error {
        @apply border-kong-error/50 bg-kong-error/5;
      }
    }
  }

  .error-message {
    @apply text-kong-error text-sm px-2 mb-2;
  }

  .send-btn {
    @apply w-full py-3 bg-kong-primary text-white rounded-lg
           font-medium hover:bg-kong-primary-hover 
           disabled:opacity-50 disabled:cursor-not-allowed
           disabled:hover:bg-kong-primary;
  }

  .validation-status {
    @apply text-sm mt-2 px-1;
    &.success {
      @apply text-kong-success;
    }
    &.error {
      @apply text-kong-error;
    }
  }

  .balance-info {
    @apply text-right text-sm text-kong-text-primary/60 mt-2;
  }

  .account-select {
    @apply w-full px-3 py-2.5 bg-black/20 rounded-lg 
           text-kong-text-primary
           border border-white/5 hover:border-white/10
           focus:border-kong-primary focus:outline-none;
  }

  .balance-row {
    @apply flex justify-between text-sm text-kong-text-primary/60 py-0.5;

    &.total {
      @apply mt-2 pt-2 border-t border-white/10 
             text-kong-text-primary font-medium;
    }
  }

  .confirm-box {
    @apply p-6;

    .transfer-summary {
      @apply mb-6 text-center;

      .amount-display {
        @apply flex items-baseline justify-center gap-2;

        .amount {
          @apply text-3xl font-bold text-kong-text-primary;
        }

        .symbol {
          @apply text-lg text-kong-text-primary/70;
        }
      }
    }

    .details-grid {
      @apply space-y-3 mb-6;

      .detail-item {
        @apply flex justify-between items-center p-3 rounded-lg bg-white/5;

        .label {
          @apply text-sm text-kong-text-primary/60;
        }

        .value {
          @apply text-sm text-kong-text-primary/90;

          &.address {
            @apply max-w-[200px] truncate;
          }

          &.type {
            @apply capitalize;
          }
        }

        &.total {
          @apply mt-4 bg-white/10;
          .label,
          .value {
            @apply font-medium text-kong-text-primary;
          }
        }
      }
    }

    .confirm-actions {
      @apply flex gap-3 pt-4 border-t border-white/10;

      button {
        @apply flex-1 py-3 rounded-lg font-medium text-center justify-center items-center gap-2;
      }

      .cancel-btn {
        @apply bg-white/10 hover:bg-white/15 text-kong-text-primary/90;
      }

      .confirm-btn {
        @apply bg-kong-primary hover:bg-kong-primary-hover 
               text-white disabled:opacity-50 
               disabled:cursor-not-allowed;
        &.loading {
          @apply bg-kong-primary/50;
        }
      }
    }
  }

  .loading-spinner {
    @apply inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full;
  }

  .scanner-container {
    @apply p-4 flex flex-col items-center gap-4;

    :global(#qr-reader) {
      @apply w-full max-w-[300px] mx-auto bg-black/20 rounded-lg overflow-hidden;

      :global(video) {
        @apply rounded-lg;
      }

      :global(#qr-reader__header_message),
      :global(#qr-reader__filescan_input),
      :global(#qr-reader__dashboard_section_csr) {
        @apply hidden;
      }

      :global(#qr-reader__scan_region) {
        @apply bg-transparent rounded-lg relative;
        border: 2px solid theme("colors.indigo.500") !important;
      }
    }

    .scanner-controls {
      @apply flex gap-3 mt-4;
    }

    .switch-camera-btn {
      @apply px-4 py-2 bg-white/10 hover:bg-white/15 text-kong-text-primary/90 
                   rounded-lg flex items-center justify-center;
    }

    .cancel-scan-btn {
      @apply px-4 py-2 bg-white/10 hover:bg-white/15 text-kong-text-primary/90 rounded-lg;
    }
  }
</style>
