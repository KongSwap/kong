<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import { toastStore } from "$lib/stores/toastStore";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { Check, Loader2, ChevronsRight, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
  import type { SwapToken, SwapQuote } from '../types/swap.types';

  interface Props {
    payToken: SwapToken | null;
    payAmount: string;
    receiveToken: SwapToken | null;
    receiveAmount: string;
    quote: SwapQuote | null;
    onConfirm: () => void;
    onCancel: () => void;
  }

  let {
    payToken,
    payAmount,
    receiveToken,
    receiveAmount,
    quote: _quote,
    onConfirm,
    onCancel,
  }: Props = $props();

  // State variables
  let isLoading = $state(false);
  let showSuccess = $state(false);
  let mounted = $state(false);
  
  // Animation states
  let buttonScale = $state(1);
  let successScale = $state(0);
  let arrowPosition = $state(0);
  let isHovered = $state(false);

  // Particle system - reduced count for performance
  let particles = $state<Array<{ id: number; x: number; y: number; size: number; delay: number }>>([]);
  
  onMount(() => {
    mounted = true;
    
    // Create fewer floating particles for better performance
    particles = Array.from({ length: 6 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      delay: Math.random() * 10
    }));
  });

  async function handleConfirm() {
    if (isLoading) return;

    isLoading = true;

    try {
      await onConfirm();
      showSuccess = true;
      successScale = 1;
      setTimeout(() => {
        onCancel();
      }, 1500);
    } catch (e) {
      console.error("Swap confirmation error:", e);
      toastStore.error(e.message || "Swap failed");
      onCancel();
    } finally {
      isLoading = false;
    }
  }

  // Button interaction handlers
  function handleMouseDown() {
    if (!isLoading) {
      buttonScale = 0.98;
    }
  }

  function handleMouseUp() {
    buttonScale = isHovered ? 1.02 : 1;
  }

  function handleMouseEnter() {
    isHovered = true;
    if (!isLoading) {
      buttonScale = 1.02;
      arrowPosition = 10;
    }
  }

  function handleMouseLeave() {
    isHovered = false;
    buttonScale = 1;
    arrowPosition = 0;
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget && !isLoading) {
      onCancel();
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !isLoading) {
      onCancel();
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<!-- Backdrop -->
<div 
  class="fixed inset-0 bg-kong-bg-primary/75 backdrop-blur-xl z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-hidden"
  transition:fade={{ duration: 200 }}
  onclick={handleBackdropClick}
>
  <!-- Close Button -->
  <button
    class="close-button"
    onclick={onCancel}
    disabled={isLoading}
    aria-label="Close confirmation"
    transition:fade={{ duration: 200 }}
  >
    <X size={24} />
  </button>
  
  <!-- Floating Particles -->
  {#if mounted}
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      {#each particles as particle}
        <div 
          class="particle"
          style="
            left: {particle.x}%;
            top: {particle.y}%;
            width: {particle.size}px;
            height: {particle.size}px;
            animation-delay: {particle.delay}s;
          "
        ></div>
      {/each}
    </div>
  {/if}

  <!-- Content Container -->
  <div 
    class="relative flex flex-col items-center gap-8 sm:gap-10 md:gap-12"
    transition:scale={{ duration: 200, start: 0.9 }}
  >
    {#if !showSuccess}
      <!-- Swap Preview -->
      <div class="swap-preview-container">
        <!-- Pay Token -->
        <div 
          class="token-container animate-slide-in-left"
          transition:scale={{ delay: 100, duration: 300 }}
        >
          <span class="token-label">You Send</span>
          <div class="token-image-wrapper token-float-up">
            <div class="token-pulse-ring"></div>
            <div class="token-pulse-ring ring-2"></div>
            {#if payToken}
              <div class="sm:hidden">
                <TokenImages tokens={[payToken as any]} size={80} />
              </div>
              <div class="hidden sm:block">
                <TokenImages tokens={[payToken as any]} size={120} />
              </div>
            {/if}
            <div class="token-glow"></div>
          </div>
          <div class="token-details">
            <span class="token-amount animate-number-appear">{formatToNonZeroDecimal(parseFloat(payAmount))}</span>
            <span class="token-symbol">{payToken?.symbol}</span>
          </div>
        </div>

        <!-- Arrow Container -->
        <div class="arrow-wrapper animate-fade-in sm:block" transition:scale={{ delay: 150, duration: 300 }}>
          <div class="arrow-container">
            <!-- Arrow animation placeholder -->
          </div>
        </div>

        <!-- Receive Token -->
        <div 
          class="token-container animate-slide-in-right"
          transition:scale={{ delay: 200, duration: 300 }}
        >
          <span class="token-label">You Receive</span>
          <div class="token-image-wrapper token-float-down">
            <div class="token-pulse-ring receive"></div>
            <div class="token-pulse-ring receive ring-2"></div>
            {#if receiveToken}
              <div class="sm:hidden">
                <TokenImages tokens={[receiveToken as any]} size={80} />
              </div>
              <div class="hidden sm:block">
                <TokenImages tokens={[receiveToken as any]} size={120} />
              </div>
            {/if}
            <div class="token-glow receive"></div>
          </div>
          <div class="token-details">
            <span class="token-amount animate-number-appear-delayed">{formatToNonZeroDecimal(parseFloat(receiveAmount))}</span>
            <span class="token-symbol">{receiveToken?.symbol}</span>
          </div>
        </div>
      </div>

      <!-- Transaction Details -->
      <div class="transaction-details">
        <div class="detail-row">
          <span class="detail-label">Rate</span>
          <span class="detail-value">1 {payToken?.symbol} = {(Number(receiveAmount) / Number(payAmount)).toFixed(6)} {receiveToken?.symbol}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Total Fees</span>
          <span class="detail-value">
            {formatToNonZeroDecimal(0.00081)} {receiveToken?.symbol}
          </span>
        </div>
      </div>

      <!-- Confirm Button -->
      <div class='flex justify-center w-full animate-slide-in-up' transition:scale={{ delay: 250, duration: 300 }}>
        <button
          class="confirm-button"
          onclick={handleConfirm}
          onmousedown={handleMouseDown}
          onmouseup={handleMouseUp}
          onmouseenter={handleMouseEnter}
          onmouseleave={handleMouseLeave}
          disabled={isLoading}
          style="transform: scale({buttonScale})"
        >
          <div class="button-background">
            <div class="button-shimmer"></div>
          </div>
          <div class="button-content">
            {#if isLoading}
              <Loader2 class="w-5 h-5 animate-spin" />
              <span>Processing...</span>
            {:else}
              <span>Confirm Swap</span>
              <ChevronsRight class="w-5 h-5 transition-transform" style="transform: translateX({arrowPosition * 0.3}px)" />
            {/if}
          </div>
        </button>
      </div>
    {:else}
      <!-- Success State -->
      <div 
        class="success-container animate-success-appear"
        style="transform: scale({successScale})"
      >
        <div class="success-icon-wrapper">
          <div class="success-ring"></div>
          <div class="success-ring-2"></div>
          <div class="success-particles">
            {#each Array(8) as _, i}
              <div class="success-particle" style="--angle: {i * 45}deg"></div>
            {/each}
          </div>
          <div class="success-icon animate-bounce-in">
            <Check size={48} strokeWidth={3} />
          </div>
        </div>
        <p class="success-text animate-fade-in-up">Swap Initiated!</p>
      </div>
    {/if}
  </div>
</div>

<style lang="postcss">
  /* Particle System - Optimized with will-change */
  .particle {
    @apply absolute rounded-full;
    background-color: rgba(255, 255, 255, 0.15);
    will-change: transform, opacity;
    animation: float-up 15s linear infinite !important;
  }

  /* Swap Preview Container */
  .swap-preview-container {
    @apply grid grid-cols-[1fr_auto_1fr] items-center gap-6 sm:gap-8 md:gap-12;
  }

  /* Token Container */
  .token-container {
    @apply flex flex-col items-center gap-3;
    animation-duration: 0.6s;
    animation-fill-mode: both;
  }

  .token-label {
    @apply text-sm font-medium text-kong-text-secondary uppercase tracking-wider pb-4;
    animation: fade-in-down 0.6s ease-out;
  }

  .token-image-wrapper {
    @apply relative;
    will-change: transform;
    transform-style: preserve-3d;
  }

  /* Token float animations with GPU acceleration */
  .token-image-wrapper.token-float-up {
    animation: token-float-up 4s ease-in-out infinite !important;
    animation-fill-mode: both;
  }

  .token-image-wrapper.token-float-down {
    animation: token-float-down 4s ease-in-out infinite !important;
    animation-fill-mode: both;
  }

  .token-pulse-ring {
    @apply absolute inset-0 rounded-full pointer-events-none;
    border: 2px solid rgb(var(--brand-primary) / 0.5);
    will-change: transform, opacity;
    animation: pulse-ring-optimized 2.5s cubic-bezier(0, 0, 0.2, 1) infinite !important;
    transform-origin: center;
  }

  .token-pulse-ring.receive {
    border-color: rgb(var(--semantic-success) / 0.5);
  }

  .token-pulse-ring.ring-2 {
    animation-delay: 1.25s;
    border-width: 1px;
    border-color: rgb(var(--brand-primary) / 0.3);
  }
  
  .token-pulse-ring.receive.ring-2 {
    border-color: rgb(var(--semantic-success) / 0.3);
  }

  .token-glow {
    @apply absolute inset-0 rounded-full opacity-30 pointer-events-none;
    background: radial-gradient(circle, rgba(var(--brand-primary) / 0.2), transparent 70%);
    filter: blur(15px);
    transform: scale(1.1);
    will-change: opacity;
  }

  .token-glow.receive {
    background: radial-gradient(circle, rgba(var(--semantic-success) / 0.2), transparent 70%);
  }

  .token-container:hover .token-glow {
    @apply opacity-50;
    transition: opacity 0.3s ease;
  }

  .token-details {
    @apply flex flex-col items-center gap-1 mt-6;
  }

  .token-amount {
    @apply text-3xl font-bold text-kong-text-primary tracking-tight;
  }

  .token-symbol {
    @apply text-lg text-kong-text-secondary font-medium;
  }

  /* Arrow Styling */
  .arrow-wrapper {
    @apply relative;
  }

  .arrow-container {
    @apply relative flex items-center justify-center w-12 h-12 sm:w-8 sm:h-12 
           rounded-full text-kong-text-primary/40
            transition-all duration-300;
    animation: arrow-move-horizontal 3s ease-in-out infinite;
  }

  @media (max-width: 640px) {
    .arrow-container {
      animation: arrow-move-vertical 3s ease-in-out infinite;
    }
  }

  /* Transaction Details */
  .transaction-details {
    @apply w-full max-w-sm space-y-2 px-6 py-4 bg-kong-bg-secondary/50 rounded-kong-roundness;
  }

  .detail-row {
    @apply flex justify-between text-sm;
  }

  .detail-label {
    @apply text-kong-text-secondary;
  }

  .detail-value {
    @apply text-kong-text-primary font-medium;
  }


  /* Confirm Button */
  .confirm-button {
    @apply relative px-10 py-4 min-w-[220px]
           rounded-full overflow-hidden
           transition-all duration-200
           active:scale-98
           disabled:opacity-70 disabled:cursor-not-allowed;
    box-shadow: var(--swap-button-shadow, none);
  }
  
  .confirm-button:hover:not(:disabled) {
    filter: brightness(1.1);
    box-shadow: var(--swap-button-shadow, none);
  }

  .button-background {
    @apply absolute inset-0 rounded-full transition-all duration-300;
    background: linear-gradient(135deg, 
      var(--swap-button-primary-gradient-start, rgb(var(--brand-primary) / 0.95)) 0%, 
      var(--swap-button-primary-gradient-end, rgb(var(--brand-secondary) / 0.95)) 100%);
    border: 1px solid var(--swap-button-border-color, rgb(var(--ui-border) / 0.3));
  }

  .button-shimmer {
    @apply absolute inset-0 opacity-100 transition-opacity duration-300;
    background: linear-gradient(105deg, 
      transparent 40%, 
      rgba(255, 255, 255, 0.3) 50%, 
      transparent 60%);
    animation: shimmer 2s infinite !important;
  }

  .confirm-button:hover .button-shimmer {
    @apply opacity-50;
  }

  .confirm-button:hover .button-background {
    @apply brightness-110;
  }

  .button-content {
    @apply relative z-10 flex items-center justify-center gap-2
           font-semibold text-lg tracking-wide;
    color: var(--swap-button-text-color, rgb(var(--text-light)));
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  /* Success State */
  .success-container {
    @apply flex flex-col items-center gap-6;
  }

  .success-icon-wrapper {
    @apply relative;
  }

  .success-ring {
    @apply absolute inset-0 w-24 h-24 rounded-full border-4;
    border-color: rgb(var(--semantic-success) / 0.3);
    animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
  }

  .success-ring-2 {
    @apply absolute inset-0 w-24 h-24 rounded-full border-2;
    border-color: rgb(var(--semantic-success) / 0.2);
    animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
    animation-delay: 0.5s;
  }

  .success-particles {
    @apply absolute inset-0 w-24 h-24;
  }

  .success-particle {
    @apply absolute w-2 h-2 rounded-full top-1/2 left-1/2;
    background-color: rgb(var(--semantic-success));
    transform-origin: center;
    animation: particle-burst 0.6s ease-out forwards;
  }

  .success-icon {
    @apply relative w-24 h-24 rounded-full
           flex items-center justify-center
           backdrop-blur-sm;
    background-color: rgb(var(--semantic-success) / 0.2);
    color: rgb(var(--semantic-success));
  }

  .success-text {
    @apply text-2xl font-bold text-white tracking-tight;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  }

  /* Optimized Animations - GPU accelerated */
  @keyframes float-up {
    0% {
      transform: translate3d(0, 100vh, 0);
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    90% {
      opacity: 1;
    }
    100% {
      transform: translate3d(0, -100vh, 0);
      opacity: 0;
    }
  }

  @keyframes token-float-up {
    0%, 100% {
      transform: translate3d(0, 0, 0);
    }
    50% {
      transform: translate3d(0, -15px, 0);
    }
  }

  @keyframes token-float-down {
    0%, 100% {
      transform: translate3d(0, 0, 0);
    }
    50% {
      transform: translate3d(0, 15px, 0);
    }
  }

  @keyframes pulse-ring-optimized {
    0% {
      transform: scale(0.8);
      opacity: 0;
    }
    50% {
      opacity: 1;
    }
    100% {
      transform: scale(1.6);
      opacity: 0;
    }
  }

  @keyframes arrow-move-horizontal {
    0%, 100% {
      transform: translateX(-15px);
    }
    50% {
      transform: translateX(15px);
    }
  }

  @keyframes arrow-move-vertical {
    0%, 100% {
      transform: translateY(-10px);
    }
    50% {
      transform: translateY(10px);
    }
  }

  @keyframes ping {
    75%, 100% {
      transform: scale(2);
      opacity: 0;
    }
  }

  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }

  @keyframes particle-burst {
    0% {
      transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0) scale(0);
      opacity: 1;
    }
    100% {
      transform: translate(-50%, -50%) rotate(var(--angle)) translateX(60px) scale(1);
      opacity: 0;
    }
  }

  @keyframes fade-in-down {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fade-in-up {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slide-in-left {
    from {
      opacity: 0;
      transform: translateX(-30px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes slide-in-right {
    from {
      opacity: 0;
      transform: translateX(30px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes slide-in-up {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes number-appear {
    0% {
      opacity: 0;
      transform: scale(0.8) rotateX(90deg);
    }
    50% {
      transform: scale(1.1) rotateX(0deg);
    }
    100% {
      opacity: 1;
      transform: scale(1) rotateX(0deg);
    }
  }

  @keyframes bounce-in {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    50% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  @keyframes success-appear {
    from {
      opacity: 0;
      transform: scale(0.8) rotate(-180deg);
    }
    to {
      opacity: 1;
      transform: scale(1) rotate(0deg);
    }
  }

  .animate-fade-in-up {
    animation: fade-in-up 0.6s ease-out;
    animation-delay: 0.2s;
    animation-fill-mode: both;
  }

  .animate-fade-in {
    animation: fade-in-down 0.6s ease-out;
  }

  .animate-slide-in-left {
    animation: slide-in-left 0.6s ease-out;
  }

  .animate-slide-in-right {
    animation: slide-in-right 0.6s ease-out;
  }

  .animate-slide-in-up {
    animation: slide-in-up 0.6s ease-out;
  }

  .animate-number-appear {
    animation: number-appear 0.8s ease-out;
    animation-fill-mode: both;
  }

  .animate-number-appear-delayed {
    animation: number-appear 0.8s ease-out;
    animation-delay: 0.2s;
    animation-fill-mode: both;
  }

  .animate-bounce-in {
    animation: bounce-in 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  }

  .animate-success-appear {
    animation: success-appear 0.6s ease-out;
  }

  /* Close Button */
  .close-button {
    @apply fixed top-4 right-4 sm:top-6 sm:right-6
           w-10 h-10 sm:w-12 sm:h-12 rounded-full
           flex items-center justify-center
           transition-all duration-200
           hover:bg-white/10
           active:scale-95
           disabled:opacity-50 disabled:cursor-not-allowed
           z-10;
    color: rgba(255, 255, 255, 0.6);
  }
  
  .close-button:hover:not(:disabled) {
    color: rgba(255, 255, 255, 0.9);
    background-color: rgba(255, 255, 255, 0.1);
    transform: rotate(90deg);
  }

  /* Mobile Optimization */
  @media (max-width: 640px) {
    .swap-preview-container {
      @apply gap-4;
    }

    .token-amount {
      @apply text-xl sm:text-2xl;
    }

    .token-symbol {
      @apply text-sm sm:text-base;
    }

    .arrow-container {
      @apply w-12 h-12;
    }

    .confirm-button {
      @apply px-6 py-3 text-base min-w-[180px];
    }

    .button-content {
      @apply text-base;
    }

    .token-pulse-ring {
      transform: scale(1.2);
    }

    .token-glow {
      transform: scale(1.1);
    }

    .success-icon {
      @apply w-20 h-20;
    }

    .success-ring,
    .success-ring-2 {
      @apply w-20 h-20;
    }

    .success-text {
      @apply text-xl;
    }
  }

  /* Extra small devices */
  @media (max-width: 380px) {
    .token-amount {
      @apply text-lg;
    }

    .confirm-button {
      @apply px-4 min-w-[160px];
    }
  }

  /* Reduce motion for accessibility */
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
    
    .particle,
    .token-float-up,
    .token-float-down,
    .token-pulse-ring {
      animation: none !important;
    }
  }
</style>