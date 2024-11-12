<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import Button from "$lib/components/common/Button.svelte";
  import SlippageSection from "./settings/SlippageSection.svelte";
  import { browser } from "$app/environment";

  export let show = false;
  export let onClose: () => void;
  export let slippage: number;
  export let onSlippageChange: (value: number) => void;

  let activeTab: "slippage" | "approvals" = browser
    ? (localStorage.getItem("settingsActiveTab") as "slippage" | "approvals") || "slippage"
    : "slippage";

  function setActiveTab(tab: "slippage" | "approvals") {
    activeTab = tab;
    if (browser) {
      localStorage.setItem("settingsActiveTab", tab);
    }
  }
</script>

<Modal show={show} title="Settings" {onClose} variant="green">
  <div class="modal-container">
    <div class="settings-header">
      <div class="tab-navigation">
        <button
          class="tab-button"
          class:active={activeTab === "slippage"}
          on:click={() => setActiveTab("slippage")}
        >
          Slippage
        </button>
        <button
          class="tab-button"
          class:active={activeTab === "approvals"}
          on:click={() => setActiveTab("approvals")}
        >
          Approvals
        </button>
      </div>
    </div>

    <div class="settings-content">
      <div class="settings-wrapper">
        <!-- Mobile View -->
        <div class="mobile-view">
          {#if activeTab === "slippage"}
            <SlippageSection {slippage} {onSlippageChange} />
          {:else}
            <div class="approvals-section">
              <!-- Add Approvals component here -->
              <p>Approvals management coming soon...</p>
            </div>
          {/if}
        </div>

        <!-- Desktop View -->
        <div class="desktop-view">
          <div class="column">
            <SlippageSection {slippage} {onSlippageChange} />
          </div>
          <div class="divider" />
          <div class="column">
            <div class="approvals-section">
              <!-- Add Approvals component here -->
              <p>Approvals management coming soon...</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-footer">
      <Button variant="yellow" text="Close" onClick={onClose} width="100%" />
    </div>
  </div>
</Modal>

<style>
  .modal-container {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .settings-header {
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .tab-navigation {
    display: none;
    width: 100%;
  }

  .tab-button {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    padding: 0.75rem;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s;
    flex: 1;
    text-align: center;
    min-width: 120px;
  }

  .tab-button.active {
    color: white;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }

  .settings-content {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }

  .settings-wrapper {
    min-height: 100%;
  }

  .desktop-view {
    display: flex;
    gap: 2rem;
    width: 100%;
  }

  .column {
    flex: 1;
    min-width: 0;
  }

  .column h3 {
    margin-bottom: 1rem;
    color: rgba(255, 255, 255, 0.9);
  }

  .divider {
    width: 1px;
    background: rgba(255, 255, 255, 0.1);
    margin: 0 1rem;
  }

  .mobile-view {
    display: none;
  }

  .settings-footer {
    padding-top: 1rem;
    flex-shrink: 0;
    margin-top: auto;
    width: 100%;
  }

  @media (max-width: 768px) {
    .desktop-view {
      display: none;
    }

    .mobile-view {
      display: block;
    }

    .tab-navigation {
      display: flex;
      gap: 0.5rem;
    }
  }
</style>
