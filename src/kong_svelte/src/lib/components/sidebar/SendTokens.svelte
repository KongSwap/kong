<script lang="ts">
  import { IcrcService } from "$lib/services/icrc/IcrcService";
  import { toastStore } from "$lib/stores/toastStore";
  import { Principal } from "@dfinity/principal";
  import Modal from '$lib/components/common/Modal.svelte';
  import { formatBalance } from '$lib/utils/numberFormatUtils';
  import BigNumber from 'bignumber.js';
  import QrScanner from '$lib/components/common/QrScanner.svelte';
  import { onMount } from 'svelte';
  import { Clipboard } from 'lucide-svelte';
  import { Camera } from 'lucide-svelte';
  import { AccountIdentifier } from '@dfinity/ledger-icp';
  import { SubAccount } from '@dfinity/ledger-icp';
  import { auth } from "$lib/services/auth";

  export let token: FE.Token;

  let recipientAddress = '';
  let amount = '';
  let isValidating = false;
  let errorMessage = '';
  let tokenFee: bigint;
  let showScanner = false;
  let hasCamera = false;
  let selectedAccount: 'main' | 'subaccount' = 'main';
  let accounts = {
      subaccount: '',
      main: ''
  };

  let balances: { default: bigint; subaccount?: bigint } = token?.symbol === 'ICP' 
      ? {
          default: BigInt(0),
          subaccount: BigInt(0)
      }
      : {
          default: BigInt(0)
      };

  async function loadTokenFee() {
      try {
          tokenFee = await IcrcService.getTokenFee(token);
      } catch (error) {
          console.error('Error loading token fee:', error);
          tokenFee = BigInt(10000); // Fallback to default fee
      }
  }

  $: if (token) {
      loadTokenFee();
  }

  $: maxAmount = token?.symbol === 'ICP' 
      ? (selectedAccount === 'main' 
          ? new BigNumber(balances.default.toString())
              .dividedBy(new BigNumber(10).pow(token.decimals))
              .minus(new BigNumber(tokenFee?.toString() || '10000').dividedBy(new BigNumber(10).pow(token.decimals)))
              .toNumber()
          : new BigNumber(balances.subaccount.toString())
              .dividedBy(new BigNumber(10).pow(token.decimals))
              .minus(new BigNumber(tokenFee?.toString() || '10000').dividedBy(new BigNumber(10).pow(token.decimals)))
              .toNumber())
      : new BigNumber(balances.default.toString())
          .dividedBy(new BigNumber(10).pow(token.decimals))
          .minus(new BigNumber(tokenFee?.toString() || '10000').dividedBy(new BigNumber(10).pow(token.decimals)))
          .toNumber();
  let addressType: 'principal' | 'account' | null = null;
  let showConfirmation = false;

  function isValidHex(str: string): boolean {
      const hexRegex = /^[0-9a-fA-F]+$/;
      return hexRegex.test(str);
  }

  function detectAddressType(address: string): 'principal' | 'account' | null {
      if (!address) return null;

      // Check for Account ID (64 character hex string)
      if (address.length === 64 && isValidHex(address)) {
          return 'account';
      }

      // Check for Principal ID
      try {
          Principal.fromText(address);
          return 'principal';
      } catch {
          return null;
      }
  }

  function validateAddress(address: string): boolean {
      if (!address) return false;

      const cleanAddress = address.trim();
      
      if (cleanAddress.length === 0) {
          errorMessage = 'Address cannot be empty';
          return false;
      }

      addressType = detectAddressType(cleanAddress);

      // Add check for non-ICP tokens with account ID
      if (addressType === 'account' && token.symbol !== 'ICP') {
          errorMessage = `Account ID can't be used with ${token.name}`;
          toastStore.error(errorMessage);
          return false;
      }

      if (addressType === null) {
          errorMessage = 'Invalid address format';
          return false;
      }

      // Handle Account ID validation
      if (addressType === 'account') {
          if (cleanAddress.length !== 64 || !isValidHex(cleanAddress)) {
              errorMessage = 'Invalid Account ID format';
              return false;
          }
          return true;
      }

      // Handle Principal ID validation
      try {
          const principal = Principal.fromText(cleanAddress);
          if (principal.isAnonymous()) {
              errorMessage = 'Cannot send to anonymous principal';
              return false;
          }
      } catch (err) {
          errorMessage = 'Invalid Principal ID format';
          return false;
      }

      errorMessage = '';
      return true;
  }

  function validateAmount(value: string): boolean {
      if (!value) return false;
      const numValue = parseFloat(value);
      
      if (isNaN(numValue) || numValue <= 0) {
          errorMessage = 'Amount must be greater than 0';
          return false;
      }
      
      const currentBalance = selectedAccount === 'main' ? balances.default : balances.subaccount;
      const maxAmount = new BigNumber(currentBalance.toString())
          .dividedBy(new BigNumber(10).pow(token.decimals))
          .minus(new BigNumber(tokenFee?.toString() || '10000').dividedBy(new BigNumber(10).pow(token.decimals)))
          .toNumber();
      
      if (numValue > maxAmount) {
          errorMessage = 'Insufficient balance';
          return false;
      }
      
      return true;
  }

  function handleAmountInput(event: Event) {
      const input = event.target as HTMLInputElement;
      let value = input.value.replace(/[^0-9.]/g, '');
      
      const parts = value.split('.');
      if (parts.length > 2) {
          value = `${parts[0]}.${parts[1]}`;
      }

      if (parts[1]?.length > token.decimals) {
          value = `${parts[0]}.${parts[1].slice(0, token.decimals)}`;
      }

      amount = value;
      errorMessage = '';
      validateAmount(value);
  }

  async function handleSubmit() {
      showConfirmation = true;
  }

  function getAccountIds(principalStr: string, rawSubaccount: any): { subaccount: string, main: string } {
      try {
          const principal = Principal.fromText(principalStr);
          
          // Create account ID with provided subaccount
          const subAccount = convertToSubaccount(rawSubaccount);
          const subaccountId = AccountIdentifier.fromPrincipal({
              principal,
              subAccount
          }).toHex();
          
          // Create account ID with main (zero) subaccount
          const mainAccountId = AccountIdentifier.fromPrincipal({
              principal,
              subAccount: undefined
          }).toHex();
          
          return {
              subaccount: subaccountId,
              main: mainAccountId
          };
      } catch (error) {
          console.error('Error creating account identifier:', error);
          return {
              subaccount: '',
              main: ''
          };
      }
  }

  function convertToSubaccount(raw: any): SubAccount | undefined {
      try {
          if (!raw) return undefined;
          
          if (raw instanceof SubAccount) return raw;
          
          let bytes: Uint8Array;
          if (raw instanceof Uint8Array) {
              bytes = raw;
          } else if (Array.isArray(raw)) {
              bytes = new Uint8Array(raw);
          } else if (typeof raw === 'number') {
              bytes = new Uint8Array(32).fill(0);
              bytes[31] = raw;
          } else {
              return undefined;
          }
          
          if (bytes.length !== 32) {
              const paddedBytes = new Uint8Array(32).fill(0);
              paddedBytes.set(bytes.slice(0, 32));
              bytes = paddedBytes;
          }
          
          const subAccountResult = SubAccount.fromBytes(bytes);
          if (subAccountResult instanceof Error) {
              throw subAccountResult;
          }
          return subAccountResult;
      } catch (error) {
          console.error('Error converting subaccount:', error);
          return undefined;
      }
  }

  $: if (auth.pnp?.account?.owner) {
      const principal = auth.pnp.account.owner;
      const principalStr = typeof principal === 'string' ? principal : principal?.toText?.() || '';
      accounts = getAccountIds(principalStr, auth.pnp?.account?.subaccount);
  }

  async function confirmTransfer() {
      isValidating = true;
      errorMessage = '';
      showConfirmation = false;

      try {
          const decimals = token.decimals || 8;
          const amountBigInt = BigInt(Math.floor(Number(amount) * 10 ** decimals).toString());

          toastStore.info(`Sending ${token.symbol}...`);
          
          const fromSubaccount = selectedAccount === 'subaccount' 
              ? auth.pnp?.account?.subaccount 
              : undefined;

          const result = await IcrcService.transfer(
              token,
              recipientAddress,
              amountBigInt,
              { 
                  fee: BigInt(token.fee_fixed),
                  fromSubaccount: fromSubaccount ? Array.from(fromSubaccount) : undefined,
              }
          );

          if (result?.Ok) {
              toastStore.success(`Successfully sent ${token.symbol}`);
              recipientAddress = '';
              amount = '';
              await loadBalances();
          } else if (result?.Err) {
              const errMsg = typeof result.Err === "object" 
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
          toastStore.warning("Hmm... Looks like you don't have enough balance for a transfer");
          return;
      }
      amount = maxAmount.toFixed(token.decimals);
      errorMessage = '';
  }

  $: {
      if (recipientAddress) {
          validateAddress(recipientAddress);
      } else {
          addressType = null;
          errorMessage = '';
      }
  }

  $: validationMessage = (() => {
      if (!recipientAddress) return { 
          type: 'info', 
          text: 'Enter a Principal ID or Account ID' 
      };
      if (errorMessage) return { 
          type: 'error', 
          text: errorMessage 
      };
      if (addressType === 'principal') return { 
          type: 'success', 
          text: 'Valid Principal ID' 
      };
      if (addressType === 'account') return { 
          type: 'success', 
          text: 'Valid Account ID' 
      };
      return { 
          type: 'error', 
          text: 'Invalid address format' 
      };
  })();

  async function handlePaste() {
      try {
          const text = await navigator.clipboard.readText();
          recipientAddress = text.trim();
      } catch (err) {
          toastStore.error('Failed to paste from clipboard');
      }
  }

  function handleScan(scannedText: string) {
      const cleanedText = scannedText.trim();
      console.log('Scanned text:', cleanedText);
      
      if (validateAddress(cleanedText)) {
          recipientAddress = cleanedText;
          toastStore.success('QR code scanned successfully');
          showScanner = false;
      } else {
          toastStore.error('Invalid QR code. Please scan a valid Principal ID or Account ID');
      }
  }

  async function checkCameraAvailability() {
      try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          hasCamera = devices.some(device => device.kind === 'videoinput');
      } catch (err) {
          console.debug('Error checking camera:', err);
          hasCamera = false;
      }
  }

  onMount(() => {
      checkCameraAvailability();
  });

  async function loadBalances() {
      try {
          if (token?.symbol === 'ICP') {
              const result: any = await IcrcService.getIcrc1Balance(
                  token,
                  auth.pnp?.account?.owner,
                  auth.pnp?.account?.subaccount ? Array.from(auth.pnp.account.subaccount) : undefined,
                  true
              );
              
              balances = {
                  default: result.default || BigInt(0),
                  subaccount: result.subaccount || BigInt(0)
              };

              // Update token object with both balances
              token = {
                  ...token,
                  balance: balances.default.toString(),
                  subaccountBalance: balances.subaccount.toString()
              };
          } else {
              // For non-ICP tokens, just get the main balance
              const result = await IcrcService.getIcrc1Balance(
                  token,
                  auth.pnp?.account?.owner,
                  undefined,
                  false
              );
              balances = {
                  default: typeof result === 'bigint' ? result : BigInt(0)
              };
          }
      } catch (error) {
          console.error('Error loading balances:', error);
          balances = token?.symbol === 'ICP' 
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

<div class="container px-4">
  <form on:submit|preventDefault={handleSubmit}>
      <div class="id-card mt-2">
          <div class="id-header">
              <span>Recipient Address</span>
              <div class="header-actions">
                  <button 
                      type="button"
                      class="action-button"
                      on:click={() => showScanner = true}
                      title="Scan QR Code"
                  >
                      <Camera class="w-4 h-4" />
                      <span class="button-text text-nowrap">Scan QR</span>
                  </button>
                  <button 
                      type="button"
                      class="action-button"
                      on:click={recipientAddress ? () => recipientAddress = '' : handlePaste}
                  >
                      {#if recipientAddress}
                          ✕
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
                      class:valid={addressType === 'principal' && !errorMessage}
                  />
              </div>
              
              {#if recipientAddress}
                  <div 
                      class="validation-status" 
                      class:success={validationMessage.type === 'success'} 
                      class:error={validationMessage.type === 'error'}
                  >
                      <span class="status-text">{validationMessage.text}</span>
                  </div>
              {/if}
          </div>
      </div>

      <div class="id-card mt-4">
          <div class="id-header">
              <span>Amount</span>
              <div class="header-actions">
                  {#if token.symbol === 'ICP' && balances.subaccount && balances.subaccount > BigInt(0)}
                      <div class="account-tabs">
                          <button 
                              type="button"
                              class="tab-button"
                              class:active={selectedAccount === 'main'}
                              on:click={() => selectedAccount = 'main'}
                          >
                              Main
                          </button>
                          <button 
                              type="button"
                              class="tab-button"
                              class:active={selectedAccount === 'subaccount'}
                              on:click={() => selectedAccount = 'subaccount'}
                          >
                              Sub
                          </button>
                      </div>
                  {/if}
                  <button type="button" class="action-button" on:click={setMaxAmount}>MAX</button>
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
                      class:error={errorMessage.includes('balance') || errorMessage.includes('Amount')}
                  />
                  <div class="balance-display">
                      Balance: {formatBalance(
                          selectedAccount === 'main' 
                              ? balances.default.toString()
                              : balances.subaccount?.toString() ?? "0", 
                          token.decimals
                      )} {token.symbol}
                  </div>
              </div>
          </div>
      </div>

      <button 
          type="submit" 
          class="send-btn"
          disabled={isValidating || !amount || !recipientAddress}
      >
          Send Tokens
      </button>
  </form>

  {#if showConfirmation}
      <Modal
          isOpen={showConfirmation}
          onClose={() => showConfirmation = false}
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
                          <span class="value">{formatBalance(tokenFee?.toString() || '10000', token.decimals)} {token.symbol}</span>
                      </div>
                      <div class="detail-item">
                          <span class="label">Receiver Gets</span>
                          <span class="value">{parseFloat(amount).toFixed(token.decimals)} {token.symbol}</span>
                      </div>
                      <div class="detail-item total">
                          <span class="label">Total Amount</span>
                          <span class="value">{(parseFloat(amount) + parseFloat(tokenFee?.toString() || '10000') / 10 ** token.decimals).toFixed(4)} {token.symbol}</span>
                      </div>
                  </div>
              </div>

              <div class="confirm-actions">
                  <button class="cancel-btn" on:click={() => showConfirmation = false}>Cancel</button>
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
          onClose={() => showScanner = false}
          onScan={handleScan}
      />
  {/if}
</div>

<style lang="postcss">
  .container {
      @apply flex flex-col gap-6;
  }

  .id-card {
      @apply flex flex-col gap-2;
  }

  .id-header {
      @apply flex justify-between items-center text-kong-text-primary/70 text-sm;
  }

  .header-actions {
      @apply flex items-center gap-2;
  }

  .action-button {
      @apply h-8 px-3 rounded-lg 
             bg-white/5 backdrop-blur-sm
             border border-white/10
             hover:border-white/20 hover:bg-white/10
             text-kong-text-primary/70 hover:text-kong-text-primary
             transition-all duration-200
             flex items-center justify-center gap-2;

      .button-text {
          @apply hidden md:inline;
      }

      &:active {
          @apply border-indigo-500 bg-indigo-500/10;
      }
  }

  .input-wrapper input {
      @apply w-full h-11 rounded-lg text-kong-text-primary px-4
             bg-white/5 backdrop-blur-sm
             border border-white/10 
             hover:border-white/20
             focus:border-indigo-500 focus:outline-none
             transition-colors;

      &::placeholder {
          @apply text-kong-text-primary/30;
      }

      &.error { 
          @apply border-red-500/50 bg-red-500/5; 
      }

      &.valid {
          @apply border-green-500/50 bg-green-500/5;
      }
  }

  .send-btn {
      @apply h-12 w-full rounded-lg bg-indigo-500 text-kong-text-primary font-medium 
             hover:bg-indigo-600 disabled:opacity-50 mt-4;
  }

  .validation-status {
      @apply text-sm mt-1 px-1;
      &.success { @apply text-green-400; }
      &.error { @apply text-red-400; }
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
              }
              
              &.total {
                  @apply mt-4 bg-white/10;
                  .label, .value {
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
              @apply bg-indigo-500 hover:bg-indigo-600 text-kong-text-primary disabled:opacity-50 disabled:cursor-not-allowed;
              &.loading {
                  @apply bg-indigo-500/50;
              }
          }
      }
  }

  .loading-spinner {
      @apply inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin;
  }

  @keyframes scan {
      0% { 
          transform: translateY(-100%);
          opacity: 0;
      }
      50% { 
          opacity: 1;
      }
      100% { 
          transform: translateY(100%);
          opacity: 0;
      }
  }

  .account-tabs {
      @apply flex gap-1 mr-2;
  }

  .tab-button {
      @apply px-3 py-1 rounded-lg text-sm
             bg-white/5 backdrop-blur-sm
             border border-white/10
             text-kong-text-primary/70
             transition-all duration-200;

      &.active {
          @apply bg-indigo-500/20 border-indigo-500 text-kong-text-primary;
      }
  }

  .balance-display {
      @apply text-sm text-kong-text-primary/60 mt-2 px-1;
  }
</style>