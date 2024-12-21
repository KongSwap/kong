<script lang="ts">
  import Dialog from '../common/Dialog.svelte';
  import ButtonV2 from '../common/ButtonV2.svelte';
  
  export let open = false;

  // App store links
  const APP_STORE_URL = 'https://apps.apple.com/app/plug-wallet/id1599570197';
  const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=co.psychedelic.plug';

  // Detect iOS vs Android
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

  export function openModal() {
    open = true;
  }
</script>

<Dialog 
  title="Use Plug Mobile App" 
  bind:open
>
  <p>Please use the Plug Mobile App to connect to this dapp on mobile devices.</p>
  
  <div slot="footer" class="footer-buttons">
    {#if isIOS()}
      <ButtonV2 
        theme="primary"
        variant="solid"
        size="lg"
        onClick={() => window.open(APP_STORE_URL, '_blank')}
      >
        <div class="store-link-content">
          <img 
            src="/apps/apple.svg" 
            alt="Download on App Store" 
            class="store-badge apple"
          />
          <span>App Store</span>
        </div>
      </ButtonV2>
    {:else}
      <ButtonV2 
        theme="primary"
        variant="solid"
        size="lg"
        onClick={() => window.open(PLAY_STORE_URL, '_blank')}
      >
        <div class="store-link-content">
          <img 
            src="/apps/google-play.svg" 
            alt="Get it on Google Play" 
            class="store-badge"
          />
          <span>Google Play</span>
        </div>
      </ButtonV2>
    {/if}
    <ButtonV2 
      label="Close"
      theme="muted"
      variant="transparent"
      size="lg"
      onClick={() => open = false}
    />
  </div>
</Dialog>

<style>
  p {
    margin: 0;
  }

  .footer-buttons {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .store-link-content {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .store-badge {
    height: 24px;
    width: auto;
  }

  .store-badge.apple {
    filter: brightness(0) invert(1);
  }
</style>