<script lang="ts">
  import { fade } from 'svelte/transition';
  import { tokenStore } from '$lib/stores/tokenStore';
  import { spring } from 'svelte/motion';
  import { toastStore } from '$lib/stores/toastStore';
  import { slide } from 'svelte/transition';

  export let payToken: string;
  export let payAmount: string;
  export let receiveToken: string;
  export let receiveAmount: string;
  export let routingPath: string[] = [];
  export let slippage: number;
  export let onClose: () => void;
  export let onConfirm: () => void;
  export let gasFees: string[] = [];
  export let lpFees: string[] = [];
  export let maxAllowedSlippage: number;

  let isLoading = false;
  let showSuccess = false;
  let countdownText = '';
  let currentStep = -1;

  const progressSpring = spring(0, {
    stiffness: 0.1,
    damping: 0.4
  });

  const scaleSpring = spring(1, {
    stiffness: 0.3,
    damping: 0.6
  });

  const slideIn = (node, { delay = 0, duration = 150 }) => ({
    delay,
    duration,
    css: t => {
      const steps = Math.floor(t * 4) / 4; // Makes animation stepped
      return `
        transform: translateY(${(1 - steps) * 16}px);
        opacity: ${steps};
      `;
    }
  });

  const scaleIn = (node, { delay = 0, duration = 150 }) => ({
    delay,
    duration,
    css: t => {
      const steps = Math.floor(t * 4) / 4; // Makes animation stepped
      return `
        transform: scale(${0.75 + (steps * 0.25)});
        opacity: ${steps};
      `;
    }
  });

  function scaleDecimalToBigInt(decimal: number, decimals: number): bigint {
    const scaleFactor = 10n ** BigInt(decimals);
    const scaledValue = decimal * Number(scaleFactor);
    return BigInt(Math.floor(scaledValue));
  }

  $: totalGasFee = routingPath.length > 0 ? 
    routingPath.slice(1).reduce((acc, _, i) => {
      const token = $tokenStore.tokens.find(t => t.symbol === routingPath[i]);
      const decimals = token?.decimals || 8;
      const gasFeeValue = typeof gasFees[i] === 'string' ? Number(gasFees[i]) : gasFees[i] || 0;
      return acc + (gasFeeValue / Math.pow(10, decimals));
    }, 0) : 0;

  $: totalLPFee = routingPath.length > 0 ?
    routingPath.slice(1).reduce((acc, _, i) => {
      const token = $tokenStore.tokens.find(t => t.symbol === routingPath[i]);
      const decimals = token?.decimals || 8;
      const lpFeeValue = typeof lpFees[i] === 'string' ? Number(lpFees[i]) : lpFees[i] || 0;
      return acc + (lpFeeValue / Math.pow(10, decimals));
    }, 0) : 0;

  function createSuccessParticles(container: Element) {
    const particleCount = 24;
    const colors = ['#00ff9d', '#ffd700', '#ff7eb6', '#7795f8'];
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'success-particle';
      
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const size = 4 + Math.random() * 8;
      const delay = Math.random() * 0.5;
      const angle = (i / particleCount) * 360;
      const distance = 100 + Math.random() * 50;
      
      particle.style.cssText = `
        --delay: ${delay}s;
        --angle: ${angle}deg;
        --distance: ${distance}px;
        width: ${size}px;
        height: ${size}px;
        background: ${randomColor};
      `;
      
      container.appendChild(particle);
      setTimeout(() => particle.remove(), 2000);
    }
  }

  function formatNumber(value: string | number): string {
    return Number(value).toFixed(8).replace(/\.?0+$/, '');
  }

  function formatDisplayNumber(value: string | number): string {
    const num = Number(value);
    
    // Handle very small numbers (keep more decimals)
    if (num < 0.0001) {
      return num.toExponential(4);
    }
    
    // Handle small numbers (up to 8 decimals)
    if (num < 1) {
      return num.toFixed(8).replace(/\.?0+$/, '');
    }
    
    // Handle larger numbers (limit decimals and add thousand separators)
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    });
  }

  async function handleConfirm() {
    if (slippage > maxAllowedSlippage) {
      toastStore.error(`Slippage (${slippage}%) exceeds your limit of ${maxAllowedSlippage}%`);
      onClose();
      return;
    }

    isLoading = true;
    currentStep = 0;
    
    try {
      const swapPromise = onConfirm();
      progressSpring.set(0);
      scaleSpring.set(0.95);
      
      const TOTAL_DURATION = 3000; // Reduced to 3 seconds total
      const numHops = routingPath.length - 1;
      const HOP_DURATION = TOTAL_DURATION / numHops;
      const IN_PROGRESS_DURATION = 400; // Reduced time to show "in progress" state
      
      countdownText = 'Preparing swap...';
      progressSpring.set(0.1);
      await new Promise(resolve => setTimeout(resolve, 200)); // Reduced initial delay
      
      for (let i = 0; i < numHops; i++) {
        currentStep = i;
        const fromToken = routingPath[i];
        const toToken = routingPath[i + 1];
        
        countdownText = `${fromToken} → ${toToken}`;
        progressSpring.set((i + 1) / numHops);
        
        // Show "in progress" state
        await new Promise(resolve => setTimeout(resolve, IN_PROGRESS_DURATION));
        
        // Show "completed" state for the remaining time of this hop
        await new Promise(resolve => setTimeout(resolve, HOP_DURATION - IN_PROGRESS_DURATION));
      }
      
      await swapPromise;
      showSuccess = true;
      scaleSpring.set(1.05);
      
      const container = document.querySelector('.modal-content');
      if (container) createSuccessParticles(container);
      
      setTimeout(() => onClose(), 1500); // Reduced success display time
      
    } catch (error) {
      currentStep = -1;
      isLoading = false;
      showSuccess = false;
      scaleSpring.set(1);
      progressSpring.set(0);
      
      scaleSpring.set(0.97);
      setTimeout(() => scaleSpring.set(1), 100);
    }
  }

  let showFees = false;
</script>

<div class="modal-overlay" transition:fade={{ duration: 150 }}>
  <div class="modal-content" transition:scaleIn={{ duration: 250 }}>
    <div class="modal-header" in:slideIn={{ delay: 50 }}>
      <h2>Review Swap</h2>
      <button class="close-button" on:click={onClose}>×</button>
    </div>

    <div class="scrollable-content">
      <!-- Top Section -->
      <div class="section top-section glass-effect" in:slideIn={{ delay: 100 }}>
        <div class="amount-row">
          <span class="label">You Pay</span>
          <div class="token-amount">
            <span class="amount glow-text">{formatDisplayNumber(payAmount)}</span>
            <div class="token-badge hover-effect">
              <img src={$tokenStore.tokens?.find(t => t.symbol === payToken)?.logo || "/tokens/not_verified.webp"} 
                   alt={payToken} class="token-icon"/>
              <span>{payToken}</span>
            </div>
          </div>
        </div>

        <div class="separator shine"></div>

        <div class="receive-section">
          <div class="amount-row">
            <span class="label">You Receive</span>
            <div class="token-amount">
              <div class="receive-amounts">
                <span class="amount">{formatDisplayNumber(receiveAmount)}</span>
                <span class="min-amount warning-text">Min: {formatDisplayNumber(Number(receiveAmount) * (1 - slippage/100))}</span>
              </div>
              <div class="token-badge">
                <img src={$tokenStore.tokens?.find(t => t.symbol === receiveToken)?.logo || "/tokens/not_verified.webp"} 
                     alt={receiveToken} class="token-icon"/>
                <span>{receiveToken}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Middle Section - Updated Route Visualization -->
      <div class="section mid-section glass-effect" in:slideIn={{ delay: 150 }}>
        <div class="route-header">
          <h3 class="section-title glow-text">Optimal Route</h3>
          <span class="route-badge">Best Price</span>
        </div>
        <div class="route-visualization">
          {#each routingPath.slice(0, -1) as token, i}
            <div class="route-step"
                 class:active={isLoading && i === currentStep}
                 class:completed={isLoading && i < currentStep}
                 in:slideIn={{ delay: 150 + (i * 30) }}>
              <div class="token-pair">
                <div class="token-badge-small from">
                  <img src={$tokenStore.tokens?.find(t => t.symbol === token)?.logo || "/tokens/not_verified.webp"}
                       alt={token}
                       class="token-icon-small"/>
                  <span class="token-symbol">{token}</span>
                </div>
                <div class="arrow-container">
                  <span class="arrow">→</span>
                  <div class="arrow-line"></div>
                </div>
                <div class="token-badge-small to">
                  <img src={$tokenStore.tokens?.find(t => t.symbol === routingPath[i + 1])?.logo || "/tokens/not_verified.webp"}
                       alt={routingPath[i + 1]}
                       class="token-icon-small"/>
                  <span class="token-symbol">{routingPath[i + 1]}</span>
                </div>
              </div>
              <div class="step-fees">
                <span class="fee-text">Gas: {formatNumber(gasFees[i])} {routingPath[i]}</span>
                <span class="fee-text">LP: {formatNumber(lpFees[i])} {routingPath[i]}</span>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Bottom Section -->
      <div class="section bottom-section glass-effect" in:slideIn={{ delay: 200 }}>
        <div class="compact-totals">
          <!-- Details Toggle Button -->
          <button class="details-toggle" on:click={() => showFees = !showFees}>
            <span>Show Details</span>
            <span class="arrow-icon">{showFees ? '▼' : '▶'}</span>
          </button>
          
          {#if showFees}
            <div class="details-content" transition:slide={{ duration: 200 }}>
              <!-- Fees Group -->
              <div class="fees-group">
                <h4 class="group-title">Network Fees</h4>
                <div class="total-row">
                  <span>Gas Fee</span>
                  <span class="mono">{formatNumber(totalGasFee)} {routingPath[0]}</span>
                </div>
                <div class="total-row">
                  <span>LP Fee</span>
                  <span class="mono">{formatNumber(totalLPFee)} {routingPath[0]}</span>
                </div>
                <div class="total-fees">
                  <span>Total Fees</span>
                  <span class="mono highlight">{formatNumber(totalGasFee + totalLPFee)} {routingPath[0]}</span>
                </div>
              </div>

              <!-- Price Impact Group -->
              <div class="price-impact-group">
                <h4 class="group-title">Price Impact</h4>
                <div class="total-row">
                  <span>Slippage Tolerance</span>
                  <span class="highlight">{slippage}%</span>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <button class="confirm-button {isLoading ? 'loading' : ''}"
            in:slideIn={{ delay: 250 }}
            on:click={handleConfirm}
            disabled={isLoading}>
      {#if showSuccess}
        <span class="success-text">Swap Success! ✨</span>
      {:else if isLoading}
        <div class="loader"></div>
        <span>{countdownText || 'Processing...'}</span>
      {:else}
        Confirm Swap
      {/if}
    </button>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    backdrop-filter: blur(8px);
    background: rgba(0, 0, 0, 0.7);
  }

  .modal-content {
    background: #2a2a2a;
    border: 4px solid #454545;
    border-radius: 0;
    box-shadow: 
      -4px -4px 0 #1a1a1a,
      4px 4px 0 #1a1a1a,
      8px 8px 0 rgba(0,0,0,0.5);
    image-rendering: pixelated;
    padding: 24px;
    color: white;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4),
                0 2px 8px rgba(255, 215, 0, 0.1);
    transform-origin: center;
    will-change: transform, opacity;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5),
                0 0 100px rgba(255, 215, 0, 0.1);
    max-height: 90vh;
    max-width: 90vw;
    width: 500px;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    transform-origin: top center;
    will-change: transform, opacity;
  }

  .modal-header h2 {
    font-size: 1.5rem;
    font-weight: 600;
  }

  .close-button {
    background: none;
    border: none;
    color: #888;
    font-size: 1.5rem;
    cursor: pointer;
  }

  .amount-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
  }

  .label {
    color: #888;
  }

  .token-amount {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .amount {
    font-family: 'Alumni Sans', sans-serif;
    font-size: 1.8em;
    font-weight: 800;
    letter-spacing: 0.5px;
  }

  .token-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #454545;
    border: 2px solid #555;
    border-radius: 4px;
    padding: 4px 8px;
    max-width: 150px;
    image-rendering: pixelated;
  }

  .token-icon {
    width: 24px;
    height: 24px;
    min-width: 24px;
    max-width: 24px;
    border-radius: 50%;
    object-fit: contain;
    image-rendering: pixelated;
  }

  .token-icon-small {
    width: 20px;
    height: 20px;
    min-width: 20px;
    max-width: 20px;
    border-radius: 50%;
    object-fit: contain;
  }

  .route-visualization {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: #2a2a2a;
    border: 2px solid #454545;
    box-shadow: 
      inset 2px 2px #1a1a1a,
      -2px -2px 0 #222,
      2px 2px 0 #444;
    image-rendering: pixelated;
  }

  .route-step {
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: all 0.2s ease;
    opacity: 0.5;
  }

  .route-step.active {
    opacity: 1;
    background: rgba(255, 215, 0, 0.1);
    border: 2px solid #ffd700;
    box-shadow: 
      0 0 20px rgba(255, 215, 0, 0.2),
      0 0 40px rgba(255, 215, 0, 0.1);
  }

  .route-step.completed {
    opacity: 0.8;
    border-color: #00ff9d;
    background: rgba(0, 255, 157, 0.1);
  }

  .route-step.completed .arrow {
    color: #00ff9d;
    text-shadow: 2px 2px #006c41;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.03); }
  }

  .route-step.active {
    animation: pulse 0.6s ease-in-out infinite; /* Faster pulse */
  }

  .token-pair {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    background: #333;
    border: 2px solid #454545;
    box-shadow: 
      inset 2px 2px #1a1a1a,
      -2px -2px 0 #222,
      2px 2px 0 #444;
    position: relative;
    gap: 12px;
    min-height: 48px;
    transition: all 0.3s ease;
  }

  .active .token-pair {
    border-color: #ffd700;
    box-shadow: 
      inset 2px 2px #1a1a1a,
      -2px -2px 0 #806c00,
      2px 2px 0 #ffe033,
      0 0 20px rgba(255, 215, 0, 0.2);
  }

  .completed .token-pair {
    border-color: #00ff9d;
    box-shadow: 
      inset 2px 2px #1a1a1a,
      -2px -2px 0 #006c41,
      2px 2px 0 #33ff9d;
  }

  .token-badge-small {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #454545;
    border: 2px solid #555;
    border-radius: 0;
    box-shadow:
      -2px -2px 0 #222,
      2px 2px 0 #666;
    transform: skew(-5deg);
    max-width: 40%;
    min-width: 80px;
  }

  .token-symbol {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100px;
  }

  .arrow-container {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .arrow {
    font-family: 'Press Start 2P', monospace;
    font-size: 1.2em;
    color: #ffd700;
    text-shadow: 2px 2px #806c00;
  }

  .step-fees {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    background: #2a2a2a;
    border: 2px solid #454545;
    box-shadow: 
      inset 2px 2px #1a1a1a,
      -1px -1px 0 #222,
      1px 1px 0 #444;
  }

  .fee-text {
    font-size: 0.85rem;
    color: #888;
    font-family: monospace;
  }

  .confirm-button {
    width: 100%;
    margin-top: 24px;
    background: #ffd700;
    border: 4px solid #b39700;
    border-radius: 4px;
    box-shadow: 
      -2px -2px 0 #806c00 inset,
      2px 2px 0 #ffe033 inset;
    text-shadow: 2px 2px #b39700;
    font-family: 'Press Start 2P', monospace;
    padding: 12px;
    transition: all 0.1s;
    font-weight: bold;
    font-size: 1.1rem;
    color: black;
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    min-height: 50px;
    transform-origin: bottom center;
    will-change: transform, opacity;
  }

  @keyframes gradientShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  .confirm-button:hover:not(.loading) {
    transform: translateY(2px);
    box-shadow: 
      -1px -1px 0 #806c00 inset,
      1px 1px 0 #ffe033 inset;
  }

  .confirm-button.loading {
    opacity: 0.8;
    cursor: wait;
  }

  .success-text {
    animation: popIn 0.3s ease-out, float 2s ease-in-out infinite;
  }

  @keyframes float {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-4px);
    }
  }

  .loader {
    width: 16px;
    height: 16px;
    border: none;
    background: transparent;
    box-shadow: 
      0 0 0 4px #000,
      4px 4px 0 4px #000,
      8px 8px 0 4px #000;
    animation: pixelSpin 1s steps(4) infinite;
  }

  @keyframes pixelSpin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes popIn {
    0% {
      transform: scale(0.8);
      opacity: 0;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .glass-effect {
    background: #333;
    border: 4px double #454545;
    box-shadow: 
      inset 2px 2px #1a1a1a,
      -2px -2px 0 #222,
      2px 2px 0 #444;
    position: relative;
    overflow: hidden;
  }

  .glass-effect::after {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255,255,255,0.1),
      transparent
    );
    animation: shine 3s 1;
  }

  .glow-text {
    text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
  }

  .separator {
    height: 2px;
    background: #454545;
    border-top: 1px solid #555;
    border-bottom: 1px solid #222;
  }

  .section {
    margin-bottom: 16px;
    padding: 16px;
    border-radius: 16px;
    transform-origin: top center;
    will-change: transform, opacity;
  }

  .section-title {
    font-family: 'Alumni Sans', sans-serif;
    font-size: 1.8em;
    font-weight: 800;
    color: #ffd700;
    text-transform: uppercase;
    text-shadow: 
      2px 2px 0 #000,
      -2px -2px 0 #000,
      4px 4px 0 rgba(0,0,0,0.5);
    letter-spacing: 1px;
  }

  .compact-totals {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .fees-group, .price-impact-group {
    background: #2a2a2a;
    border: 2px solid #454545;
    box-shadow: 
      inset 2px 2px #1a1a1a,
      -2px -2px 0 #222,
      2px 2px 0 #444;
    padding: 16px;
    image-rendering: pixelated;
  }

  .group-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.8em;
    color: #ffd700;
    text-shadow: 2px 2px #806c00;
    margin-bottom: 12px;
    text-transform: uppercase;
  }

  .total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: #333;
    border: 1px solid #454545;
    box-shadow: 
      inset 1px 1px #1a1a1a,
      -1px -1px 0 #222,
      1px 1px 0 #444;
    margin-bottom: 4px;
  }

  .total-fees {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    margin-top: 12px;
    background: #333;
    border: 2px solid #ffd700;
    box-shadow: 
      inset 2px 2px #1a1a1a,
      -2px -2px 0 #806c00,
      2px 2px 0 #ffe033;
    font-family: 'Press Start 2P', monospace;
    font-size: 1em;
  }

  .total-fees .mono.highlight {
    font-size: 1.2em;
    font-weight: 800;
    letter-spacing: 0.5px;
  }

  .highlight {
    color: #ffd700;
    text-shadow: 1px 1px #806c00;
    font-family: 'Press Start 2P', monospace;
    font-size: 0.9em;
  }

  .warning-text {
    color: #FFB800;
    text-shadow: 1px 1px #805c00;
    font-family: 'Press Start 2P', monospace;
    font-size: 0.9em;
  }

  /* Update the compact-totals grid gap */
  @media (min-width: 640px) {
    .compact-totals {
      display: grid;
      gap: 12px;
    }
  }

  .scrollable-content {
    flex: 1;
    overflow-y: auto;
    padding-right: 8px;
    margin-right: -8px;
    /* Custom scrollbar styles */
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 215, 0, 0.3) transparent;
  }

  .scrollable-content::-webkit-scrollbar {
    width: 6px;
  }

  .scrollable-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .scrollable-content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 215, 0, 0.3);
    border-radius: 3px;
  }

  @keyframes fadeAcross {
    0% {
      transform: translateX(-10px);
      opacity: 0.5;
    }
    100% {
      transform: translateX(10px);
      opacity: 1;
    }
  }

  @font-face {
    font-family: 'Press Start 2P';
    src: url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
  }

  .amount, .fee-text, .mono {
    font-family: 'Alumni Sans', sans-serif;
    font-size: 1.2em;
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  @keyframes shine {
    to {
      left: 100%;
    }
  }

  .token-badge {
    background: #454545;
    border: 2px solid #555;
    border-radius: 0;
    padding: 6px 12px;
    position: relative;
    image-rendering: pixelated;
    box-shadow:
      -2px -2px 0 #222,
      2px 2px 0 #666;
    transform: skew(-5deg);
  }

  .token-badge:hover {
    transform: skew(-5deg) translateY(-2px);
    box-shadow:
      -2px -2px 0 #222,
      2px 2px 0 #666,
      4px 4px 0 rgba(0,0,0,0.3);
  }

  .confirm-button {
    font-family: 'Alumni Sans', sans-serif;
    font-size: 1.8em;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 1px;
    border: none;
    background: #ffd700;
    box-shadow:
      -4px -4px 0 #806c00,
      4px 4px 0 #ffe033,
      8px 8px 0 rgba(0,0,0,0.3);
    text-shadow: 
      2px 2px 0 #806c00,
      -2px -2px 0 #ffe033;
    transform-origin: center;
    transition: all 0.2s ease;
  }

  .confirm-button:hover:not(.loading) {
    transform: scale(1.02) translateY(-2px);
    box-shadow:
      -4px -4px 0 #806c00,
      4px 4px 0 #ffe033,
      12px 12px 0 rgba(0,0,0,0.2);
  }

  .route-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .route-badge {
    background: #2a2a2a;
    border: 2px solid #00ff9d;
    color: #00ff9d;
    padding: 4px 8px;
    font-family: 'Press Start 2P', monospace;
    font-size: 0.7em;
    text-transform: uppercase;
    box-shadow:
      -2px -2px 0 #006c41,
      2px 2px 0 #33ff9d;
    text-shadow: 2px 2px #006c41;
  }

  /* Update the pulse animation to be faster */
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.03); }
  }

  .route-step.active {
    animation: pulse 0.6s ease-in-out infinite; /* Faster pulse */
  }

  /* Add a progress indicator for active step */
  .route-step.active .token-pair::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    background: #ffd700;
    animation: progressBar 0.4s linear;
    width: 100%;
    box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
  }

  @keyframes progressBar {
    from { width: 0; }
    to { width: 100%; }
  }

  /* Make completed steps more visible */
  .route-step.completed {
    opacity: 1;
    border-color: #00ff9d;
    background: rgba(0, 255, 157, 0.05);
  }

  .route-step.completed .token-pair {
    border-color: #00ff9d;
    box-shadow: 
      inset 2px 2px #1a1a1a,
      -2px -2px 0 #006c41,
      2px 2px 0 #33ff9d;
  }

  .details-content {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .details-toggle {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #2a2a2a;
    border: 2px solid #454545;
    color: #ffd700;
    cursor: pointer;
    font-family: 'Press Start 2P', monospace;
    font-size: 0.8em;
    text-transform: uppercase;
    box-shadow: 
      inset 2px 2px #1a1a1a,
      -2px -2px 0 #222,
      2px 2px 0 #444;
    transition: all 0.2s ease;
  }

  .details-toggle:hover {
    background: #333;
    border-color: #ffd700;
  }

  .details-content {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .receive-section {
    display: flex;
    flex-direction: column;
  }

  .warning-text {
    color: #FFB800;
    font-family: monospace;
  }

  .receive-amounts {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .min-amount {
    font-size: 0.78em;
  }

  .fees-group {
    background: #2a2a2a;
    border: 2px solid #454545;
    box-shadow: 
      inset 2px 2px #1a1a1a,
      -2px -2px 0 #222,
      2px 2px 0 #444;
    padding: 20px;
    image-rendering: pixelated;
  }
</style>
