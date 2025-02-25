<script lang="ts">
  import { derived } from "svelte/store";
  import { userTokens } from "$lib/stores/userTokens";
  import { storedBalancesStore } from "$lib/services/tokens/tokenStore";
  import { userPoolListStore } from "$lib/stores/userPoolListStore";
  import { processPortfolioData } from "$lib/components/portfolio/portfolioDataProcessor";
  import { calculateRiskMetrics } from "$lib/components/portfolio/riskAnalyzer";
  import Panel from "$lib/components/common/Panel.svelte";

  const liveUserPools = derived(userPoolListStore, (s) => s.processedPools);

  $: riskMetrics = (() => {
    const { topPositions } = processPortfolioData(
      $userTokens.tokens,
      $storedBalancesStore,
      $liveUserPools,
    );
    
    const metrics = calculateRiskMetrics(topPositions);
    const riskScore = Math.min(100, Math.round(
      0.4 * (100 - metrics.diversificationScore) +
      0.3 * metrics.protocolConcentration * 100 +
      0.2 * metrics.liquidityRisk +
      0.1 * (100 - metrics.stablecoinPercentage)
    ));

    return { 
      riskScore,
      metrics,
      recommendations: metrics.recommendations 
    };
  })();
</script>

<div class="space-y-6">
  <!-- Risk Score Header -->
  <Panel variant="transparent" className="bg-kong-bg-dark/50 rounded-xl">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-lg font-semibold text-kong-text-primary">Portfolio Risk Analysis</h2>
        <p class="text-sm text-kong-text-secondary">Updated in real-time</p>
      </div>
      <div class="text-right">
        <div class="text-3xl font-bold text-kong-text-accent-green">{riskMetrics.riskScore}
          <span class="text-base ml-1">/ 100</span>
        </div>
        <span 
          class:text-kong-text-accent-green={riskMetrics.riskScore < 30}
          class:text-yellow-500={riskMetrics.riskScore >= 30 && riskMetrics.riskScore < 60}
          class:text-kong-accent-red={riskMetrics.riskScore >= 60}
          class="text-sm font-medium"
        >
          {riskMetrics.riskScore < 30 ? 'Low Risk' :
           riskMetrics.riskScore < 60 ? 'Moderate Risk' :
           'High Risk'}
        </span>
      </div>
    </div>

    <!-- Animated Progress Bar -->
    <div class="h-3 bg-kong-bg-dark rounded-full overflow-hidden">
      <div class="h-full bg-gradient-to-r from-kong-accent-green via-yellow-500 to-kong-accent-red transition-all duration-500 ease-out" 
           style={`width: ${riskMetrics.riskScore}%`} />
    </div>
  </Panel>

  <!-- Metrics Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <Panel variant="transparent" className="p-4 space-y-3">
      <div class="flex justify-between items-center">
        <span class="text-kong-text-secondary">Diversification</span>
      </div>
      <div class="h-1 bg-kong-bg-dark rounded-full">
        <div class="h-full bg-kong-accent-green rounded-full" 
             style={`width: ${riskMetrics.metrics.diversificationScore}%`} />
      </div>
      <div class="flex justify-end">
        <span class="font-mono text-sm">{riskMetrics.metrics.diversificationScore}/100</span>
      </div>
    </Panel>

    <Panel variant="transparent" className="p-4 space-y-3">
      <div class="flex justify-between items-center">
        <span class="text-kong-text-secondary">Liquidity Risk</span>
      </div>
      <div class="h-1 bg-kong-bg-dark rounded-full">
        <div class="h-full bg-kong-accent-red rounded-full" 
             style={`width: ${riskMetrics.metrics.liquidityRisk}%`} />
      </div>
      <div class="flex justify-end">
        <span class="font-mono text-sm">
          {riskMetrics.metrics.liquidityRisk.toFixed(1)}/100
          <span class="text-xs opacity-75 ml-1">
            (${(riskMetrics.metrics.liquidityRisk * riskMetrics.metrics.totalValue / 100).toFixed(2)})
          </span>
        </span>
      </div>
    </Panel>
  </div>

  <!-- Recommendations Card -->
  {#if riskMetrics.recommendations.length > 0}
    <Panel variant="transparent" className="bg-kong-bg-dark/50 rounded-xl">
      <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
        <svg class="w-5 h-5 text-kong-accent-yellow" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>
        Actionable Recommendations
      </h3>
      <div class="space-y-3">
        {#each riskMetrics.recommendations as rec}
          <div class="flex items-start gap-3 p-3 bg-kong-bg-dark rounded-lg">
            <div class="w-2 h-2 mt-2.5 bg-kong-accent-red rounded-full flex-shrink-0"/>
            <p class="text-sm leading-relaxed text-kong-text-secondary">{rec}</p>
          </div>
        {/each}
      </div>
    </Panel>
  {/if}

  <div class="text-xs text-kong-text-secondary mt-4 space-y-2">
    <p class="font-medium">Liquidity Risk Factors:</p>
    <ul class="list-disc pl-4 space-y-1">
      <li>Pool TVL vs. token market caps</li>
      <li>Pools with TVL &lt; 5% of smallest token's market cap</li>
      <li>Tokens with market cap &lt; $100M</li>
      <li>Manually marked 'illiquid' assets</li>
    </ul>
  </div>
</div>
