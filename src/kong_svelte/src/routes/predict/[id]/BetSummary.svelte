<script lang="ts">
  export let betAmount: number;
  export let potentialWin: number;
  export let odds: string;
</script>

<div class="bg-kong-bg-light/10 rounded p-3 border border-kong-border/10">
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <span class="text-xs text-kong-text-secondary">Your bet</span>
      <span class="font-medium text-sm">{betAmount.toLocaleString()} KONG</span>
    </div>
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-1">
        <span class="text-xs text-kong-text-secondary">Potential win</span>
        <div class="group relative">
          <span class="cursor-help text-xs text-kong-text-secondary/60">ⓘ</span>
          <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 w-40 p-1.5 bg-kong-bg-dark rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all text-xs text-kong-text-secondary">
            Estimated based on current pool distribution
          </div>
        </div>
      </div>
      <span class="font-medium text-sm text-kong-accent-green">
        {potentialWin.toLocaleString()} KONG
      </span>
    </div>
    <div class="flex items-center justify-between">
      <span class="text-xs text-kong-text-secondary">Return multiplier</span>
      <span class="font-medium text-sm text-kong-accent-green">
        {odds}
      </span>
    </div>
  </div>
</div> 