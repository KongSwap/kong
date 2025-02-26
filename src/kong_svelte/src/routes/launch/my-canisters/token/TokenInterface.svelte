<script lang="ts">
  // Token interface component
  export let canister: {
    id: string;
    tokenName: string;
    tokenSymbol: string;
    totalSupply: string;
    decimals: number;
  };

  // Format token amount with proper decimals
  function formatTokenAmount(amount: string, decimals: number): string {
    const value = BigInt(amount);
    const divisor = BigInt(10) ** BigInt(decimals);
    const wholePart = value / divisor;
    const fractionalPart = value % divisor;
    
    // Format fractional part with leading zeros
    let fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    // Trim trailing zeros
    fractionalStr = fractionalStr.replace(/0+$/, '');
    
    if (fractionalStr.length > 0) {
      return `${wholePart.toString()}.${fractionalStr}`;
    } else {
      return wholePart.toString();
    }
  }
</script>

<div>
  <h2 class="mb-4 text-xl font-bold">{canister.tokenName} ({canister.tokenSymbol})</h2>
  
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div class="p-4 rounded-lg bg-kong-bg-light/5">
      <h3 class="mb-2 text-sm font-medium text-kong-text-secondary">Canister ID</h3>
      <p class="font-mono">{canister.id}</p>
    </div>
    
    <div class="p-4 rounded-lg bg-kong-bg-light/5">
      <h3 class="mb-2 text-sm font-medium text-kong-text-secondary">Total Supply</h3>
      <p>{formatTokenAmount(canister.totalSupply, canister.decimals)} {canister.tokenSymbol}</p>
    </div>
  </div>
  
  <!-- Additional token functionality can be added here -->
</div> 