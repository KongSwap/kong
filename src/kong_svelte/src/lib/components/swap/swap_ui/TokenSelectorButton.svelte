<script lang="ts">
  import Button from "$lib/components/common/Button.svelte";
  import { formattedTokens } from "$lib/services/tokens/tokenStore";

  export let token: string;
  export let onClick: () => void;
  export let disabled: boolean = false;

  $: tokenInfo = $formattedTokens.find(t => t.symbol === token);
  $: logoUrl = tokenInfo?.logo || "/tokens/default.svg";
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
        // Fallback to default logo if image fails to load
        e.currentTarget.src = "tokens/default.svg";
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
