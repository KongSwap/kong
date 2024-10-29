<script lang="ts">
    import { fade } from 'svelte/transition';
    import Button from '$lib/components/common/Button.svelte';
    import { formatNumberCustom } from '$lib/utils/formatNumberCustom';
    
    export let payToken: string;
    export let payAmount: string;
    export let receiveToken: string;
    export let receiveAmount: string;
    export let onConfirm: () => void;
    export let onClose: () => void;
    
    // Calculated values
    const exchangeRate = Number(receiveAmount) / Number(payAmount);
    const impact = 0.5; // Example - should be calculated based on actual market data
    const fee = Number(payAmount) * 0.003; // Example - should use actual fee calculation
    </script>
    
    <div class="confirmation-container" transition:fade>
      <div class="summary-section">
        <div class="summary-row">
          <span>You Pay</span>
          <div class="token-amount">
            <img src="/tokens/{payToken}.svg" alt={payToken} />
            <span>{formatNumberCustom(payAmount, 6)} {payToken}</span>
          </div>
        </div>
    
        <div class="arrow">↓</div>
    
        <div class="summary-row">
          <span>You Receive</span>
          <div class="token-amount">
            <img src="/tokens/{receiveToken}.svg" alt={receiveToken} />
            <span>{formatNumberCustom(receiveAmount, 6)} {receiveToken}</span>
          </div>
        </div>
      </div>
    
      <div class="details-section">
        <div class="detail-row">
          <span>Exchange Rate</span>
          <span>1 {payToken} = {formatNumberCustom(exchangeRate, 6)} {receiveToken}</span>
        </div>
    
        <div class="detail-row">
          <span>Price Impact</span>
          <span class="impact">{impact}%</span>
        </div>
    
        <div class="detail-row">
          <span>Fee</span>
          <span>{formatNumberCustom(fee, 6)} {payToken}</span>
        </div>
      </div>
    
      <div class="buttons-container">
        <Button
          variant="yellow"
          text="Confirm Swap"
          onClick={onConfirm}
          className="confirm-button"
        />
    
        <Button
          variant="blue"
          text="Cancel"
          onClick={onClose}
          className="cancel-button"
        />
      </div>
    </div>
    
    <style>
      .confirmation-container {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        padding: 1rem;
      }
    
      .summary-section {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        background: rgba(0, 0, 0, 0.2);
        padding: 1rem;
        border-radius: 0.5rem;
      }
    
      .summary-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
    
      .token-amount {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
    
      .token-amount img {
        width: 1.5rem;
        height: 1.5rem;
      }
    
      .arrow {
        text-align: center;
        font-size: 1.5rem;
        opacity: 0.5;
      }
    
      .details-section {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 0.5rem;
      }
    
      .detail-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.9rem;
        opacity: 0.8;
      }
    
      .impact {
        color: #ffd700;
      }
    
      .buttons-container {
        display: flex;
        gap: 1rem;
      }
    
      :global(.confirm-button) {
        flex: 2;
      }
    
      :global(.cancel-button) {
        flex: 1;
      }
    </style>
