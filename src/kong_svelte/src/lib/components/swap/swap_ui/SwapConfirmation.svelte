<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import { toastStore } from "$lib/stores/toastStore";
  import TokenImages from "$lib/components/common/TokenImages.svelte";
  import { Check, Loader2, ChevronsRight } from 'lucide-svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { panelRoundness } from "$lib/stores/derivedThemeStore";
  import { onMount } from 'svelte';

  const { 
    payToken,
    payAmount: initialPayAmount,
    receiveToken,
    receiveAmount: initialReceiveAmount,
    onClose,
    onConfirm
  } = $props<{
    payToken: Kong.Token;
    payAmount: string;
    receiveToken: Kong.Token;
    receiveAmount: string;
    onClose: () => void;
    onConfirm: () => Promise<boolean>;
  }>();

  // State variables
  let isLoading = $state(false);
  let showSuccess = $state(false);
  let mounted = $state(false);
  
  // Animation states
  const buttonScale = tweened(1, { duration: 150, easing: cubicOut });
  const successScale = tweened(0, { duration: 300, easing: cubicOut });
  const arrowPosition = tweened(0, { duration: 300, easing: cubicOut });
  const tokenFloat = tweened(0, { duration: 2000, easing: cubicOut });
  let isHovered = $state(false);
  let isPressed = $state(false);

  // Particle system
  let particles = $state<Array<{ id: number; x: number; y: number; size: number; delay: number }>>([]);
  
  onMount(() => {
    mounted = true;
    // Create floating particles
    particles = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      delay: Math.random() * 3
    }));
    
    // Start floating animation
    const floatInterval = setInterval(() => {
      tokenFloat.update(v => v === 0 ? 1 : 0);
    }, 2000);
    
    return () => clearInterval(floatInterval);
  });

  async function handleConfirm() {
    if (isLoading) return;

    isLoading = true;

    try {
      const result = await onConfirm();
      if (result) {
        showSuccess = true;
        successScale.set(1);
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (e) {
      console.error("Swap confirmation error:", e);
      toastStore.error(e.message || "Swap failed");
      onClose();
    } finally {
      isLoading = false;
    }
  }

  // Button interaction handlers
  function handleMouseDown() {
    if (!isLoading) {
      isPressed = true;
      buttonScale.set(0.98);
    }
  }

  function handleMouseUp() {
    isPressed = false;
    buttonScale.set(isHovered ? 1.02 : 1);
  }

  function handleMouseEnter() {
    isHovered = true;
    if (!isLoading) {
      buttonScale.set(1.02);
      arrowPosition.set(10);
    }
  }

  function handleMouseLeave() {
    isHovered = false;
    isPressed = false;
    buttonScale.set(1);
    arrowPosition.set(0);
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !isLoading) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<!-- Backdrop -->
<div 
  class="fixed inset-0 bg-black/85 backdrop-blur-xl z-50 flex items-center justify-center p-4 overflow-hidden"
  transition:fade={{ duration: 200 }}
  onclick={handleBackdropClick}
>
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
    class="relative flex flex-col items-center gap-12"
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
          <div class="token-image-wrapper" style="transform: translateY({-$tokenFloat * 5}px)">
            <div class="token-pulse-ring"></div>
            <TokenImages tokens={[payToken]} size={120} />
            <div class="token-glow animate-pulse-glow"></div>
          </div>
          <div class="token-details">
            <span class="token-amount animate-number-appear">{initialPayAmount}</span>
            <span class="token-symbol">{payToken.symbol}</span>
          </div>
        </div>

        <!-- Arrow Container -->
        <div class="arrow-wrapper animate-fade-in" transition:scale={{ delay: 150, duration: 300 }}>
          <div class="arrow-container">
            <!-- Moving particles -->
            <div class="moving-particle particle-1"></div>
            <div class="moving-particle particle-2"></div>
            <div class="moving-particle particle-3"></div>
          </div>
        </div>

        <!-- Receive Token -->
        <div 
          class="token-container animate-slide-in-right"
          transition:scale={{ delay: 200, duration: 300 }}
        >
          <div class="token-image-wrapper" style="transform: translateY({$tokenFloat * 5}px)">
            <div class="token-pulse-ring receive"></div>
            <TokenImages tokens={[receiveToken]} size={120} />
            <div class="token-glow receive animate-pulse-glow-delayed"></div>
          </div>
          <div class="token-details">
            <span class="token-amount animate-number-appear-delayed">{initialReceiveAmount}</span>
            <span class="token-symbol">{receiveToken.symbol}</span>
          </div>
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
          style="transform: scale({$buttonScale})"
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
              <ChevronsRight class="w-5 h-5 transition-transform" style="transform: translateX({$arrowPosition * 0.3}px)" />
            {/if}
          </div>
        </button>
      </div>
    {:else}
      <!-- Success State -->
      <div 
        class="success-container animate-success-appear"
        style="transform: scale({$successScale})"
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
  /* Particle System */
  .particle {
    @apply absolute rounded-full bg-white/10 animate-float-up;
  }

  /* Swap Preview Container */
  .swap-preview-container {
    @apply grid grid-cols-[1fr_auto_1fr] items-center gap-8 md:gap-12;
  }

  /* Token Container */
  .token-container {
    @apply flex flex-col items-center gap-4;
    animation-duration: 0.6s;
    animation-fill-mode: both;
  }

  .token-image-wrapper {
    @apply relative;
  }

  .token-pulse-ring {
    @apply absolute inset-0 rounded-full border-2 border-kong-success/30 animate-pulse-ring;
    transform: scale(1.3);
  }

  .token-pulse-ring.receive {
    @apply border-kong-success/30;
  }

  .token-glow {
    @apply absolute inset-0 rounded-full opacity-0 transition-opacity duration-300;
    background: radial-gradient(circle, rgba(var(--brand-success) / 0.3), transparent 70%);
    filter: blur(20px);
    transform: scale(1.2);
  }

  .token-glow.receive {
    background: radial-gradient(circle, rgba(var(--semantic-success) / 0.3), transparent 70%);
  }

  .token-container:hover .token-glow {
    @apply opacity-100;
  }

  .token-details {
    @apply flex flex-col items-center gap-1;
  }

  .token-amount {
    @apply text-3xl font-bold text-white tracking-tight;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  }

  .token-symbol {
    @apply text-lg text-white/70 font-medium;
  }

  /* Arrow Styling */
  .arrow-wrapper {
    @apply relative;
  }

  .arrow-container {
    @apply relative flex items-center justify-center w-8 h-12 
           rounded-full text-kong-text-primary/40
            transition-all duration-300;
    animation: arrow-move-horizontal 3s ease-in-out infinite;
  }

  .arrow-trail {
    @apply absolute left-0 top-1/2 w-full h-0.5 bg-gradient-to-r from-transparent via-white/30 to-transparent
           -translate-y-1/2 -translate-x-full;
    animation: arrow-trail 2s linear infinite;
  }

  .arrow-glow {
    @apply absolute inset-0 rounded-full opacity-0 transition-opacity duration-300;
    background: radial-gradient(circle, rgba(var(--brand-primary) / 0.4), transparent 60%);
    filter: blur(15px);
  }

  .arrow-container:hover .arrow-glow {
    @apply opacity-100;
  }


  /* Moving particles */
  .moving-particle {
    @apply absolute w-2 h-2 rounded-full bg-white/40;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    animation: particle-move 3s ease-in-out infinite;
  }

  .particle-1 {
    animation-delay: 0s;
  }

  .particle-2 {
    animation-delay: 1s;
    @apply w-1.5 h-1.5 bg-white/20;
  }

  .particle-3 {
    animation-delay: 2s;
    @apply w-1 h-1 bg-white/20;
  }

  /* Confirm Button */
  .confirm-button {
    @apply relative px-10 py-4 min-w-[220px]
           rounded-full overflow-hidden
           transition-all duration-200
           hover:shadow-2xl hover:shadow-kong-success/30
           active:scale-98
           disabled:opacity-70 disabled:cursor-not-allowed;
  }

  .button-background {
    @apply absolute inset-0 bg-gradient-to-r from-kong-success to-kong-success/50 text-kong-text-success border border-kong-success rounded-full
           transition-all duration-300;
  }

  .button-shimmer {
    @apply absolute inset-0 opacity-0 transition-opacity duration-300;
    background: linear-gradient(105deg, 
      transparent 40%, 
      rgba(255, 255, 255, 0.3) 50%, 
      transparent 60%);
    animation: shimmer 2s infinite;
  }

  .confirm-button:hover .button-shimmer {
    @apply opacity-100;
  }

  .confirm-button:hover .button-background {
    @apply brightness-110;
  }

  .button-content {
    @apply relative z-10 flex items-center justify-center gap-2
           text-kong-text-success font-semibold text-lg tracking-wide;
  }

  /* Success State */
  .success-container {
    @apply flex flex-col items-center gap-6;
  }

  .success-icon-wrapper {
    @apply relative;
  }

  .success-ring {
    @apply absolute inset-0 w-24 h-24 rounded-full border-4 border-kong-success/30;
    animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
  }

  .success-ring-2 {
    @apply absolute inset-0 w-24 h-24 rounded-full border-2 border-kong-success/20;
    animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
    animation-delay: 0.5s;
  }

  .success-particles {
    @apply absolute inset-0 w-24 h-24;
  }

  .success-particle {
    @apply absolute w-2 h-2 bg-kong-success rounded-full top-1/2 left-1/2;
    transform-origin: center;
    animation: particle-burst 0.6s ease-out forwards;
  }

  .success-icon {
    @apply relative w-24 h-24 rounded-full bg-kong-success/20 
           flex items-center justify-center text-kong-success
           backdrop-blur-sm;
  }

  .success-text {
    @apply text-2xl font-bold text-white tracking-tight;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  }

  /* Animations */
  @keyframes float-up {
    0% {
      transform: translateY(100vh) rotate(0deg);
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    90% {
      opacity: 1;
    }
    100% {
      transform: translateY(-100vh) rotate(360deg);
      opacity: 0;
    }
  }

  @keyframes pulse-ring {
    0%, 100% {
      transform: scale(1.3);
      opacity: 0;
    }
    50% {
      transform: scale(1.5);
      opacity: 0.3;
    }
  }

  @keyframes pulse-glow {
    0%, 100% {
      opacity: 0.3;
      transform: scale(1.2);
    }
    50% {
      opacity: 0.6;
      transform: scale(1.3);
    }
  }

  @keyframes pulse-glow-delayed {
    0%, 100% {
      opacity: 0.3;
      transform: scale(1.2);
    }
    50% {
      opacity: 0.6;
      transform: scale(1.3);
    }
  }

  @keyframes arrow-trail {
    0% {
      transform: translateX(-100%) translateY(-50%);
    }
    100% {
      transform: translateX(100%) translateY(-50%);
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

  @keyframes arrow-pulse {
    0%, 100% {
      opacity: 0.8;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.1);
    }
  }

  @keyframes particle-move {
    0% {
      transform: translate(-50%, -50%) translateX(-40px);
      opacity: 0;
    }
    20% {
      opacity: 1;
    }
    80% {
      opacity: 1;
    }
    100% {
      transform: translate(-50%, -50%) translateX(40px);
      opacity: 0;
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

  /* Animation Classes */
  .animate-float-up {
    animation: float-up 10s linear infinite;
  }

  .animate-pulse-ring {
    animation: pulse-ring 2s ease-out infinite;
  }

  .animate-pulse-glow {
    animation: pulse-glow 2s ease-in-out infinite;
  }

  .animate-pulse-glow-delayed {
    animation: pulse-glow-delayed 2s ease-in-out infinite;
    animation-delay: 1s;
  }

  .animate-arrow-trail {
    animation: arrow-trail 2s ease-in-out infinite;
  }

  .animate-fade-in-down {
    animation: fade-in-down 0.6s ease-out;
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

  .animate-pulse-slow {
    animation: pulse 3s ease-in-out infinite;
  }

  /* Mobile Optimization */
  @media (max-width: 640px) {
    .swap-preview-container {
      @apply gap-4;
    }

    .token-amount {
      @apply text-2xl;
    }

    .token-symbol {
      @apply text-base;
    }

    .arrow-container {
      @apply w-12 h-12;
    }

    .arrow-icon {
      @apply w-6 h-6;
    }

    .confirm-button {
      @apply px-8 py-3 text-base;
    }
  }
</style>
