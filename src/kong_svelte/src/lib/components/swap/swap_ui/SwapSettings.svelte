<script lang="ts">
  import Panel from "$lib/components/common/Panel.svelte";
  import Button from "$lib/components/common/Button.svelte";
  import { fade } from "svelte/transition";
  import SlippageSection from "./settings/SlippageSection.svelte";
  import ApprovalSection from "./settings/ApprovalSection.svelte";

  export let show = false;
  export let onClose: () => void;
  export let slippage: number;
  export let onSlippageChange: (value: number) => void;
  
  // New props for token approvals
  export let tokens: Token[] = [];
  export let approvedTokens: Set<string> = new Set();
  export let onApproveToken: (token: Token) => Promise<void>;
  export let onRevokeToken: (token: Token) => Promise<void>;
</script>

{#if show}
  <div class="modal-overlay" on:click={onClose}>
    <div
      class="modal-content settings-modal"
      transition:fade={{ duration: 200 }}
      on:click|stopPropagation
    >
      <Panel variant="green" type="main" width="auto">
        <div class="settings-container">
          <div class="settings-header">
            <h2 class="settings-title">Settings</h2>
            <button class="close-button" on:click={onClose}>✕</button>
          </div>

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

<style lang="postcss">
  .modal-content {
    max-height: 90vh;
    margin: 2rem;
  }
  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 2px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }

  .settings-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .settings-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 1.25rem;
    margin: 0;
    color: #ffcd1f;
  }

  .close-button {
    background: none;
    border: none;
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0.5rem;
    opacity: 0.8;
    transition: opacity 0.2s;
  }

  .close-button:hover {
    opacity: 1;
  }

  .settings-footer {
    padding: 1.5rem;
    border-top: 2px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }

  /* Scrollbar styling */
  .settings-content::-webkit-scrollbar {
    width: 0.375rem;
  }

  .settings-content::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 0.25rem;
  }

  .settings-content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 0.25rem;
  }

  .settings-content::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  /* Mobile responsiveness */
  @media (max-width: 640px) {
    .modal-content {
      margin: 1rem;
      width: calc(100vw - 2rem);
    }

    .settings-container {
      min-height: 400px;
    }

    .settings-header,
    .settings-content,
    .settings-footer {
      padding: 1rem;
    }
  }
</style>
