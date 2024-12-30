<script lang="ts">
  import Modal from "$lib/components/common/Modal.svelte";
  import IdentityPanel from "./account/IdentityPanel.svelte";
  import { accountStore } from "$lib/stores/accountStore";

  export let show = false;
  let activeTab = "identity";

  accountStore.subscribe((state) => {
    show = state.showDetails;
    activeTab = state.activeTab;
  });

  let isMobile = false;

  // Check if mobile on mount and update on resize
  const checkMobile = () => {
    isMobile = window.innerWidth < 768;
  };

  if (typeof window !== "undefined") {
    checkMobile();
    window.addEventListener("resize", checkMobile);
  }
</script>

<Modal
  isOpen={show}
  title="My Addresses"
  onClose={() => accountStore.hideAccountDetails()}
  height="auto"
>
  <div class="account-details">
    <div class="content-wrapper">
      <div class="tab-content">
        <IdentityPanel />
      </div>
    </div>
  </div>
</Modal>

<style>
  .account-details {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    min-height: 500px;
    height: 100%;
  }

  .content-wrapper {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
    min-height: 400px;
  }

  .content-wrapper::-webkit-scrollbar {
    width: 6px;
  }

  .content-wrapper::-webkit-scrollbar-track {
    background: transparent;
  }

  .content-wrapper::-webkit-scrollbar-thumb {
    @apply bg-kong-bg-dark;
    border-radius: 3px;
  }
</style>
