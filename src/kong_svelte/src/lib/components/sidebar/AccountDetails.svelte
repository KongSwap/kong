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
  variant="transparent"
>
  <IdentityPanel />
</Modal>
