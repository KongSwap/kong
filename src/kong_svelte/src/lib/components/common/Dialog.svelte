<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import ButtonV2 from './ButtonV2.svelte';
  
  export let title: string;
  export let showClose = true;
  export let closeLabel = "Close";
  export let open: boolean;
  export let onClose = (source: 'backdrop' | 'button') => {};

  function handleBackdropClick() {
    open = false;
    onClose('backdrop');
  }

  function handleCloseClick() {
    open = false;
    onClose('button');
  }
</script>

{#if open}
  <div 
    role="dialog"
    class="dialog-backdrop"
    in:fade={{ duration: 200 }}
    out:fade={{ duration: 200 }}
  >
    <button
      class="backdrop-button"
      on:click={handleBackdropClick}
      aria-label="Close dialog"
    ></button>
    <div 
      class="dialog-content" 
      role="document"
      in:fly={{ y: 20, duration: 300, delay: 100 }}
      out:fly={{ y: 20, duration: 200 }}
    >
      <div class="dialog-header">
        <h2>{title}</h2>
      </div>
      <div class="dialog-body">
        <slot open={open} />
      </div>
      <div class="dialog-footer">
        <slot name="footer" {open}>
          {#if showClose}
            <ButtonV2 
              label={closeLabel}
              theme="primary"
              variant="solid"
              size="lg"
              onClick={handleCloseClick}
            />
          {/if}
        </slot>
      </div>
    </div>
  </div>
{/if}

<style lang="postcss">
  .dialog-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .dialog-content {
    background: linear-gradient(180deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%);
    border-radius: 24px;
    padding: 24px;
    max-width: 90%;
    width: 480px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 
      0 0 0 1px rgba(255, 255, 255, 0.05),
      0 20px 40px -8px rgba(0, 0, 0, 0.5),
      0 12px 20px -8px rgba(0, 0, 0, 0.3);
    transform-origin: center center;
    position: relative;
    overflow: hidden;
  }

  .dialog-content::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 80px;
    background: linear-gradient(180deg, 
      rgba(var(--color-k-light-blue), 0.1) 0%,
      rgba(var(--color-k-light-blue), 0) 100%
    );
    opacity: 0.5;
    pointer-events: none;
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    position: relative;
  }

  .dialog-header h2 {
    color: white;
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.3;
  }

  .close-button {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
    transform: scale(1.05);
  }

  .close-button svg {
    width: 18px;
    height: 18px;
    stroke-width: 2.5;
  }

  .dialog-body {
    color: rgba(255, 255, 255, 0.8);
    margin: 0;
    line-height: 1.5;
    position: relative;
  }

  .dialog-footer {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    align-items: center;
    margin-top: 24px;
    position: relative;
  }

  .backdrop-button {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    border: none;
    cursor: pointer;
  }

  .done-button {
    background: theme(colors.k-light-blue);
    color: white;
    padding: 12px 24px;
    border-radius: 12px;
    font-weight: 500;
    font-size: 1rem;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .done-button:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  @media (max-width: 480px) {
    .dialog-backdrop {
      padding: 16px;
    }

    .dialog-content {
      padding: 20px;
      border-radius: 20px;
    }

    .dialog-header h2 {
      font-size: 1.25rem;
    }

    .dialog-header {
      margin-bottom: 16px;
    }

    .dialog-footer {
      margin-top: 20px;
    }
  }
</style> 