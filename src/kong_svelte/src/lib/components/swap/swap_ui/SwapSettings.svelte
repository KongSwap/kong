<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import Button from "$lib/components/common/Button.svelte";
  import SlippageSection from "./settings/SlippageSection.svelte";
  import { browser } from "$app/environment";

  export let show = false;
  export let onClose: () => void;
  export let userMaxSlippage: number;
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
  <div class="flex flex-col h-full">
    <div class="border-b border-white/10 md:hidden">
      <div class="flex w-full gap-2">
        <button
          class="flex-1 bg-transparent border-none text-white/70 p-3 cursor-pointer text-base transition-all min-w-[120px] text-center hover:text-white"
          class:active={activeTab === "slippage"}
          on:click={() => setActiveTab("slippage")}
        >
          Slippage
        </button>
        <button
          class="flex-1 bg-transparent border-none text-white/70 p-3 cursor-pointer text-base transition-all min-w-[120px] text-center hover:text-white"
          class:active={activeTab === "approvals"}
          on:click={() => setActiveTab("approvals")}
        >
          Approvals
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
      <div class="min-h-full">
        <!-- Mobile View (Tabbed) -->
        <div class="block md:hidden">
          {#if activeTab === "slippage"}
            <SlippageSection {userMaxSlippage} {onSlippageChange} />
          {:else}
            <div class="approvals-section">
              <p>Approvals management coming soon...</p>
            </div>
          {/if}
        </div>

        <!-- Desktop View (Side by Side) -->
        <div class="hidden md:flex gap-8 w-full">
          <div class="flex-1 min-w-0">
            <SlippageSection {userMaxSlippage} {onSlippageChange} />
          </div>
          <div class="w-px bg-white/10 mx-4" />
          <div class="flex-1 min-w-0">
            <div class="approvals-section">
              <p>Approvals management coming soon...</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="pt-4 flex-shrink-0 mt-auto w-full">
      <Button variant="yellow" text="Close" onClick={onClose} width="100%" />
    </div>
  </div>
</Modal>

<style>
  .active {
    color: white;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }
</style>
