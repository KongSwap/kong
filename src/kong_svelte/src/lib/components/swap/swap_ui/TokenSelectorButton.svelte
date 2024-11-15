<script lang="ts">
  import Button from "$lib/components/common/Button.svelte";
  import { formattedTokens } from "$lib/services/tokens/tokenStore";
  import { getTokenLogo, tokenLogoStore } from '$lib/services/tokens/tokenLogo';

  export let token: FE.Token;
  export let onClick: () => void;
  export let disabled: boolean;

  let tokenInfo: FE.Token | null = null;
  let logoUrl = '/tokens/not_verified.webp';

  $: tokenInfo = $formattedTokens.find(t => t.canister_id === token?.canister_id);
  
  $: {
    if (tokenInfo?.canister_id) {
      if ($tokenLogoStore[tokenInfo.canister_id]) {
        logoUrl = $tokenLogoStore[tokenInfo.canister_id];
      } else {
        getTokenLogo(tokenInfo.canister_id).then(url => {
          if (url) logoUrl = url;
        });
      }
    }
  }
</script>

<Button
  variant="yellow"
  size="big"
  {onClick}
  {disabled}
  className="token-selector-button"
>
  <div class="token-button-content">
    <img
      src={logoUrl}
      alt={tokenInfo?.symbol}
      class="token-logo"
      on:error={(e) => {
        e.currentTarget.src = "/tokens/not_verified.webp";
      }}
    />
    <span class="token-symbol">{tokenInfo?.symbol}</span>
  </div>
</Button>

<style>
  .token-button-content {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 4px;
  }

  .token-logo {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: contain;
  }

  .token-symbol {
    font-weight: 600;
  }

  .selector-icon {
    font-size: 0.8em;
    opacity: 0.7;
  }

  :global(.token-selector-button) {
    min-width: 140px;
  }
</style>
