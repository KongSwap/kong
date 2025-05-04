<script lang="ts">
	import { panelRoundness } from '$lib/stores/derivedThemeStore';
  import { fade, fly } from 'svelte/transition';
  import ButtonV2 from './ButtonV2.svelte';
  
  let { 
    title,
    showClose = true,
    closeLabel = "Close",
    open = $bindable(false),
    onClose = (source: 'backdrop' | 'button') => {},
    children = [],
    transparent = false
  } = $props<{
    title: string;
    showClose?: boolean;
    closeLabel?: string;
    open: boolean;
    onClose?: (source: 'backdrop' | 'button') => void;
    children: any;
    transparent?: boolean;
  }>();

  let isOpen = $state(open);
  $effect(() => {
    isOpen = open;
  });

  function handleBackdropClick() {
    isOpen = false;
    open = false;
    onClose('backdrop');
  }

  function handleCloseClick() {
    isOpen = false;
    open = false;
    onClose('button');
  }
</script>

{#if isOpen}
  <div 
    role="dialog"
    class="fixed inset-0 flex items-center justify-center bg-kong-bg-dark/80 backdrop-blur-md z-[1000] p-5"
    in:fade={{ duration: 200 }}
    out:fade={{ duration: 200 }}
  >
    <button
      class="fixed inset-0 bg-transparent border-none cursor-pointer"
      onclick={handleBackdropClick}
      aria-label="Close dialog"
    ></button>
    <div 
      class={`${panelRoundness} relative p-6 max-w-[90%] w-[480px] border border-kong-border shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_40px_-8px_rgba(0,0,0,0.5),0_12px_20px_-8px_rgba(0,0,0,0.3)] overflow-hidden ${
        transparent 
          ? 'bg-gradient-to-b from-kong-bg-light to-kong-bg-dark' 
          : 'bg-gradient-to-b from-kong-bg-light to-kong-bg-dark'
      }`}
      role="document"
      in:fly={{ y: 20, duration: 300, delay: 100 }}
      out:fly={{ y: 20, duration: 200 }}
    >
      <div class="relative flex items-center justify-between mb-5">
        <h2 class="text-kong-text-primary m-0 text-2xl font-semibold leading-tight">{title}</h2>
      </div>
      <div class="relative text-kong-text-secondary m-0 leading-normal">
        {@render children?.()}
      </div>
      <div class="relative flex gap-3 justify-end items-center mt-6">
        {#if showClose}
          <ButtonV2 
            label={closeLabel}
            theme="primary"
            variant="solid"
            size="lg"
            on:click={handleCloseClick}
          />
        {/if}
      </div>
    </div>
  </div>
{/if}
