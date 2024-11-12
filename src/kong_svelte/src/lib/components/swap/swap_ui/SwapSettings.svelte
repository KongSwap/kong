<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import Button from "$lib/components/common/Button.svelte";
  import SlippageSection from "./settings/SlippageSection.svelte";
  import ApprovalSection from "./settings/ApprovalSection.svelte";

  export let show = false;
  export let onClose: () => void;
  export let slippage: number;
  export let onSlippageChange: (value: number) => void;
  
  export let tokens: FE.Token[] = [];
  export let approvedTokens: Set<string> = new Set();
  export let onApproveToken: (token: FE.Token) => Promise<void>;
  export let onRevokeToken: (token: FE.Token) => Promise<void>;
</script>

<Modal
  show={show}
  title="Settings"
  onClose={onClose}
  variant="green"
  height="80vh"
>
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
</Modal>

<style>
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
</style>
