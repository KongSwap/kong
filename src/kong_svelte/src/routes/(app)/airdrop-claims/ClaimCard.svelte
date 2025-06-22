<script lang="ts">
  import { Loader2 } from "lucide-svelte";
  import ButtonV2 from '$lib/components/common/ButtonV2.svelte';
  import type { Claim } from '$lib/types/claims';
  import { formatBalance } from '$lib/utils/numberFormatUtils';

  export let claim: Claim;
  export let isProcessing: boolean;
  export let isProcessingAll: boolean;
  export let processingClaimId: bigint | null;
  export let onProcess: (claimId: bigint) => void;
  
  const DEFAULT_IMAGE = "/tokens/not_verified.webp";

  interface FormattedTimestamp {
    date: string;
    time: string;
  }

  function formatTimestamp(timestamp: bigint): FormattedTimestamp {
    const date = new Date(Number(timestamp) / 1_000_000);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString()
    };
  }

  $: timestamp = formatTimestamp(claim.ts);
</script>

<div class="p-4 sm:p-6 flex flex-col h-full">
  <!-- Token info header with status -->
  <div class="flex justify-between items-start mb-4">
    <div class="flex items-start">
      <div class="w-10 h-10 sm:w-12 sm:h-12 mr-3 rounded-full overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-700 bg-kong-bg-secondary shadow-sm">
        <img 
          src={claim.logo_url} 
          alt={claim.symbol} 
          class="w-full h-full object-cover"
          on:error={(e) => (e.currentTarget as HTMLImageElement).src = DEFAULT_IMAGE}
        />
      </div>
      <div>
        <div class="flex items-center flex-wrap gap-2">
          <h3 class="text-base sm:text-lg font-bold">{claim.symbol}</h3>
          <span class="text-xs px-2 py-0.5 rounded-full bg-kong-success/20 text-kong-success">
            {claim.chain}
          </span>
        </div>
        <p class="text-xl sm:text-2xl font-bold text-kong-text-primary mt-1">
          {formatBalance(claim.amount, claim.decimals)}
        </p>
      </div>
    </div>
    <div class="text-right shrink-0 ml-2">
      <div class="text-xs text-kong-text-secondary mb-1">Created</div>
      <div class="text-sm font-medium">{timestamp.date}</div>
      <div class="text-xs text-kong-text-secondary">{timestamp.time}</div>
    </div>
  </div>
  
  <div class="border-t border-kong-border mb-4"></div>
  
  <div class="flex-grow space-y-3 mb-5">
    {#if claim.desc}
      <div class="rounded-md bg-kong-bg-secondary/50 p-3">
        <div class="text-xs font-medium text-kong-text-secondary mb-1">Description</div>
        <p class="text-sm text-kong-text-secondary break-words">{claim.desc}</p>
      </div>
    {/if}
    
    <div class="flex flex-col sm:flex-row justify-between gap-3 sm:gap-4">
      <div class="flex-1 min-w-0">
        <div class="text-xs font-medium text-kong-text-secondary mb-1">Recipient Address</div>
        <div class="flex items-center">
          <p class="text-sm font-mono text-kong-text-secondary truncate" title={claim.to_address}>
            {claim.to_address.slice(0, 5)}...{claim.to_address.slice(-7)}
          </p>
        </div>
      </div>
      
      <div class="shrink-0">
        <div class="text-xs font-medium text-kong-text-secondary mb-1">Claim ID</div>
        <p class="text-sm font-mono text-kong-text-secondary">
          {claim.claim_id.toString()}
        </p>
      </div>
    </div>
  </div>
  
  <div class="mt-auto">
    <ButtonV2 
      theme="accent-green"
      variant={isProcessing && processingClaimId === claim.claim_id ? "solid" : "shine"}
      fullWidth={true}
      isDisabled={isProcessing || isProcessingAll}
      animationIterations={1}
      onclick={() => onProcess(claim.claim_id)}
      className="min-h-[40px]"
    >
      {#if isProcessing && processingClaimId === claim.claim_id}
        <div class="flex items-center justify-center">
          <Loader2 class="animate-spin mr-2" size={16} />
          <span>Processing...</span>
        </div>
      {:else if isProcessingAll}
        <div class="flex items-center justify-center">
          {#if processingClaimId === claim.claim_id}
            <Loader2 class="animate-spin mr-2" size={16} />
            <span>Processing...</span>
          {:else}
            <span>Waiting...</span>
          {/if}
        </div>
      {:else}
        Claim Tokens
      {/if}
    </ButtonV2>
  </div>
</div> 