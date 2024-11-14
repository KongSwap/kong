<script lang="ts">
  import Button from "$lib/components/common/Button.svelte";
  import { formattedTokens, tokenLogos } from "$lib/services/tokens/tokenStore";

  interface TokenSelectorButtonProps {
    token: string;
    onClick: () => void;
    disabled: boolean;
  }

  let { token, onClick, disabled }: TokenSelectorButtonProps = $props();

  let tokenInfo: FE.Token | null = null;
  let logoUrl = $state('/tokens/not_verified.webp');

  $effect(() => {
    tokenInfo = $formattedTokens.find(t => t.symbol === token);
    logoUrl = tokenInfo ? $tokenLogos[tokenInfo.canister_id] || tokenInfo.logo || '/tokens/not_verified.webp' : '/tokens/not_verified.webp';
  }); 

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
      alt={token}
      class="token-logo"
      on:error={(e) => {
        e.currentTarget.src = "/tokens/not_verified.webp";
      }}
    />
    <span class="token-symbol">{token}</span>
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
