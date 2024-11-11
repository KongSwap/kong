<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import Button from "$lib/components/common/Button.svelte";
  import { fade } from "svelte/transition";
  import SlippageSection from "./settings/SlippageSection.svelte";
  import ApprovalSection from "./settings/ApprovalSection.svelte";
  import { browser } from "$app/environment";
  import { onMount } from "svelte";

  export let show = false;
  export let onClose: () => void;
  export let slippage: number;
  export let onSlippageChange: (value: number) => void;
  
  export let tokens: FE.Token[] = [];
  export let approvedTokens: Set<string> = new Set();
  export let onApproveToken: (token: FE.Token) => Promise<void>;
  export let onRevokeToken: (token: FE.Token) => Promise<void>;

  let isMobile = false;
  let panelWidth = "600px";

  onMount(() => {
    if (browser) {
      const updateWidth = () => {
        const width = window.innerWidth;
        if (width <= 768) {
          const calculatedWidth = Math.max(300, Math.min(width - 50, 600));
          panelWidth = `${calculatedWidth}px`;
        } else {
          panelWidth = "600px";
        }
        isMobile = width <= 768;
      };
      
      updateWidth();
      window.addEventListener('resize', updateWidth);
    }
  });
</script>

{#if show}
  <div 
    class="modal-overlay" 
    on:click={onClose}
    role="dialog"
    aria-modal="true"
    aria-label="Settings dialog"
    transition:fade={{ duration: 200 }}
  >
    <div 
      class="modal-container"
      on:click|stopPropagation
    >
      <Panel 
        variant="green" 
        width={panelWidth}
        height="80vh"
        className="settings-modal"
      >
        <div class="modal-content">
          <header class="modal-header">
            <h2 id="modal-title" class="settings-title">Settings</h2>
            <button 
              class="action-button close-button !border-0 !shadow-none group relative"
              on:click={onClose}
              aria-label="Close settings"
            >
              <span class="pointer-events-none absolute -top-8 z-[1000] left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition before:absolute before:left-1/2 before:bottom-[-6px] before:-translate-x-1/2 before:border-4 before:border-transparent before:border-b-gray-900 before:rotate-180 before:content-[''] group-hover:opacity-100">
                Close
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="#ff4444"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </header>

          <div class="settings-content">
            <SlippageSection {slippage} {onSlippageChange} />
            
            <ApprovalSection
              {tokens}
              {approvedTokens}
              onApprove={onApproveToken}
              onRevoke={onRevokeToken}
            />
          </div>

          <div class="settings-footer">
            <Button
              variant="yellow"
              text="Close"
              onClick={onClose}
              width="100%"
            />
          </div>
        </div>
      </Panel>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 50;
    display: grid;
    place-items: center;
    overflow: hidden;
  }

  .modal-container {
    position: relative;
    transform: translateY(0);
    animation: modalSlideIn 200ms ease-out;
  }

  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .modal-content {
    padding: 1.5rem;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .settings-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 1.875rem;
    font-weight: bold;
    color: #ffcd1f;
    margin: 0;
  }

  .action-button {
    border: 1px solid var(--sidebar-border);
    padding: 6px;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    width: 40px;
    height: 40px;
    flex-shrink: 0;
  }

  .action-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  }

  .action-button:focus-visible {
    outline: 2px solid var(--sidebar-border);
    outline-offset: 2px;
  }

  .close-button {
    background: rgba(186, 49, 49, 0.4);
    color: #ffffff;
  }

  .close-button:hover {
    background: rgba(255, 68, 68, 0.5);
  }

  .settings-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }

  .settings-content::-webkit-scrollbar {
    width: 6px;
  }

  .settings-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .settings-content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 9999px;
  }

  .settings-content::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.3);
  }

  .settings-footer {
    padding: 1.5rem;
    border-top: 2px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
