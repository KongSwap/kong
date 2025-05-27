<script lang="ts">
  import { onMount } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  
  let {
    state = 'idle',
    progress = 0,
    message = ''
  } = $props<{
    state?: 'idle' | 'loading' | 'confirming' | 'processing' | 'success' | 'error';
    progress?: number;
    message?: string;
  }>();
  
  const progressValue = tweened(0, {
    duration: 300,
    easing: cubicOut
  });
  
  $effect(() => {
    progressValue.set(progress);
  });
  
  // Particle effect for success state
  let particles: Array<{ x: number; y: number; vx: number; vy: number; life: number }> = [];
  
  function createParticles() {
    particles = Array.from({ length: 20 }, () => ({
      x: 50,
      y: 50,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4 - 2,
      life: 1
    }));
    
    animateParticles();
  }
  
  function animateParticles() {
    particles = particles.map(p => ({
      ...p,
      x: p.x + p.vx,
      y: p.y + p.vy,
      vy: p.vy + 0.1,
      life: p.life - 0.02
    })).filter(p => p.life > 0);
    
    if (particles.length > 0) {
      requestAnimationFrame(animateParticles);
    }
  }
  
  $effect(() => {
    if (state === 'success') {
      createParticles();
    }
  });
</script>

<div class="relative w-full h-full">
  {#if state === 'loading'}
    <!-- Loading spinner with progress -->
    <div class="absolute inset-0 flex items-center justify-center">
      <svg class="w-8 h-8" viewBox="0 0 50 50">
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          opacity="0.1"
        />
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-dasharray={`${$progressValue * 1.26} 126`}
          stroke-linecap="round"
          transform="rotate(-90 25 25)"
          class="transition-all duration-300"
        />
      </svg>
    </div>
  {/if}
  
  {#if state === 'confirming'}
    <!-- Pulsing confirmation indicator -->
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="relative">
        <div class="absolute inset-0 bg-white/20 rounded-full animate-ping"></div>
        <div class="relative w-3 h-3 bg-white rounded-full"></div>
      </div>
    </div>
  {/if}
  
  {#if state === 'processing'}
    <!-- Processing animation with dots -->
    <div class="absolute inset-0 flex items-center justify-center gap-1">
      {#each Array(3) as _, i}
        <div 
          class="w-2 h-2 bg-white rounded-full animate-bounce"
          style="animation-delay: {i * 0.1}s"
        ></div>
      {/each}
    </div>
  {/if}
  
  {#if state === 'success'}
    <!-- Success checkmark with particles -->
    <div class="absolute inset-0 flex items-center justify-center">
      <svg class="w-8 h-8 animate-scale-in" viewBox="0 0 24 24" fill="none">
        <path
          d="M5 13l4 4L19 7"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="animate-draw"
        />
      </svg>
      
      <!-- Particle effects -->
      <svg class="absolute inset-0 pointer-events-none" viewBox="0 0 100 100">
        {#each particles as particle}
          <circle
            cx={particle.x}
            cy={particle.y}
            r="2"
            fill="currentColor"
            opacity={particle.life}
          />
        {/each}
      </svg>
    </div>
  {/if}
  
  {#if state === 'error'}
    <!-- Error X with shake -->
    <div class="absolute inset-0 flex items-center justify-center">
      <svg class="w-8 h-8 animate-shake" viewBox="0 0 24 24" fill="none">
        <path
          d="M18 6L6 18M6 6l12 12"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    </div>
  {/if}
  
  {#if message}
    <div class="absolute -bottom-6 left-0 right-0 text-center">
      <span class="text-xs text-gray-400">{message}</span>
    </div>
  {/if}
</div>

<style>
  @keyframes scale-in {
    from {
      transform: scale(0);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }
  
  @keyframes draw {
    from {
      stroke-dasharray: 24;
      stroke-dashoffset: 24;
    }
    to {
      stroke-dasharray: 24;
      stroke-dashoffset: 0;
    }
  }
  
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-4px); }
    75% { transform: translateX(4px); }
  }
  
  .animate-scale-in {
    animation: scale-in 0.3s ease-out;
  }
  
  .animate-draw {
    animation: draw 0.4s ease-out 0.2s forwards;
    stroke-dasharray: 24;
    stroke-dashoffset: 24;
  }
  
  .animate-shake {
    animation: shake 0.3s ease-out;
  }
</style> 