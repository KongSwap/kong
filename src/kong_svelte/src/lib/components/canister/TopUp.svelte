<script lang="ts">
  import { onMount } from 'svelte';
  import { topUpCanister, calculateCyclesFromIcp } from '$lib/services/canister/top_up_canister';
  import { Principal } from '@dfinity/principal';
  import { formatNumber } from '$lib/utils/number';
  import { formatCycles } from '$lib/utils/cycles';
  import { formatICP } from '$lib/utils/icp';
  
  // Form state
  let canisterId = '';
  let icpAmount = '10'; // Default to minimum 10 ICP
  let isLoading = false;
  let error = '';
  let success = '';
  let estimatedCycles = '';
  
  // Validation state
  let canisterIdValid = false;
  let icpAmountValid = false;
  let formValid = false;
  
  // Minimum ICP amount (10 ICP)
  const MIN_ICP_AMOUNT = 10n * 100_000_000n; // 10 ICP in e8s
  
  // Update estimated cycles when ICP amount changes
  $: {
    updateEstimatedCycles();
  }
  
  // Validate form inputs
  $: {
    validateCanisterId();
    validateIcpAmount();
    formValid = canisterIdValid && icpAmountValid;
  }
  
  // Validate canister ID
  function validateCanisterId() {
    try {
      if (!canisterId) {
        canisterIdValid = false;
        return;
      }
      
      // Try to parse as Principal to validate
      Principal.fromText(canisterId);
      canisterIdValid = true;
    } catch (e) {
      canisterIdValid = false;
    }
  }
  
  // Validate ICP amount
  function validateIcpAmount() {
    try {
      const amount = parseFloat(icpAmount);
      icpAmountValid = !isNaN(amount) && amount >= 10;
    } catch (e) {
      icpAmountValid = false;
    }
  }
  
  // Update estimated cycles based on ICP amount
  async function updateEstimatedCycles() {
    try {
      if (!icpAmountValid) {
        estimatedCycles = '';
        return;
      }
      
      // Convert ICP to e8s
      const icpE8s = BigInt(Math.floor(parseFloat(icpAmount) * 100_000_000));
      
      // Calculate estimated cycles
      const cycles = await calculateCyclesFromIcp(icpE8s);
      
      // Format cycles for display
      estimatedCycles = formatCycles(cycles);
    } catch (e) {
      console.error('Error calculating cycles:', e);
      estimatedCycles = '';
    }
  }
  
  // Handle form submission
  async function handleSubmit() {
    if (!formValid) return;
    
    isLoading = true;
    error = '';
    success = '';
    
    try {
      // Convert ICP to e8s
      const icpE8s = BigInt(Math.floor(parseFloat(icpAmount) * 100_000_000));
      
      // Top up the canister
      const cyclesAdded = await topUpCanister({
        canister_id: canisterId,
        amount: icpE8s
      });
      
      // Show success message
      success = `Topped up canister with ${formatCycles(cyclesAdded)} cycles`;
    } catch (e) {
      console.error('Error topping up canister:', e);
      error = e.message || 'An error occurred while topping up the canister';
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="top-up-container">
  <h2>Top Up Canister</h2>
  <p class="description">
    Convert ICP to cycles and top up an existing canister. Minimum amount is 10 ICP.
  </p>
  
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-group">
      <label for="canisterId">Canister ID</label>
      <input
        type="text"
        id="canisterId"
        bind:value={canisterId}
        placeholder="Enter canister principal ID"
        class:invalid={!canisterIdValid && canisterId !== ''}
      />
      {#if !canisterIdValid && canisterId !== ''}
        <p class="error-text">Please enter a valid canister ID</p>
      {/if}
    </div>
    
    <div class="form-group">
      <label for="icpAmount">ICP Amount</label>
      <input
        type="number"
        id="icpAmount"
        bind:value={icpAmount}
        min="10"
        step="0.1"
        placeholder="Minimum 10 ICP"
        class:invalid={!icpAmountValid && icpAmount !== ''}
      />
      {#if !icpAmountValid && icpAmount !== ''}
        <p class="error-text">Minimum amount is 10 ICP</p>
      {/if}
    </div>
    
    {#if estimatedCycles}
      <div class="estimated-cycles">
        <p>Estimated cycles: <span class="cycles-amount">{estimatedCycles}</span></p>
      </div>
    {/if}
    
    <button type="submit" class="submit-button" disabled={!formValid || isLoading}>
      {#if isLoading}
        <span class="loading-spinner"></span>
        Processing...
      {:else}
        Top Up Canister
      {/if}
    </button>
  </form>
  
  {#if error}
    <div class="error-message">
      <p>{error}</p>
    </div>
  {/if}
  
  {#if success}
    <div class="success-message">
      <p>{success}</p>
    </div>
  {/if}
</div>

<style>
  .top-up-container {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem;
    background-color: #fff;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  
  h2 {
    margin-top: 0;
    color: #333;
    font-size: 1.8rem;
  }
  
  .description {
    color: #666;
    margin-bottom: 1.5rem;
  }
  
  .form-group {
    margin-bottom: 1.5rem;
  }
  
  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #333;
  }
  
  input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
  }
  
  input.invalid {
    border-color: #e53935;
  }
  
  .error-text {
    color: #e53935;
    font-size: 0.875rem;
    margin-top: 0.25rem;
  }
  
  .estimated-cycles {
    background-color: #f5f5f5;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1.5rem;
  }
  
  .cycles-amount {
    font-weight: 600;
    color: #2196f3;
  }
  
  .submit-button {
    width: 100%;
    padding: 0.75rem;
    background-color: #2196f3;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .submit-button:hover:not(:disabled) {
    background-color: #1976d2;
  }
  
  .submit-button:disabled {
    background-color: #b0bec5;
    cursor: not-allowed;
  }
  
  .loading-spinner {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 1s ease-in-out infinite;
    margin-right: 0.5rem;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .error-message {
    margin-top: 1.5rem;
    padding: 1rem;
    background-color: #ffebee;
    border-left: 4px solid #e53935;
    border-radius: 4px;
  }
  
  .error-message p {
    margin: 0;
    color: #c62828;
  }
  
  .success-message {
    margin-top: 1.5rem;
    padding: 1rem;
    background-color: #e8f5e9;
    border-left: 4px solid #43a047;
    border-radius: 4px;
  }
  
  .success-message p {
    margin: 0;
    color: #2e7d32;
  }
</style> 
