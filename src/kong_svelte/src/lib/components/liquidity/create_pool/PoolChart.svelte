<script lang="ts">
  import { onMount } from 'svelte';
  import Panel from "$lib/components/common/Panel.svelte";
  import { liquidityStore } from "$lib/stores/liquidityStore";
  import { formatBalance } from "$lib/utils/numberFormatUtils";
  import { livePools } from "$lib/services/pools/poolStore";
  import { BarChart3, RefreshCw } from "lucide-svelte";
  import { fetchPoolBalanceHistory } from "$lib/api/pools";
  
  // Try-catch for Chart.js import to handle SSR
  let Chart;
  let isChartAvailable = false;
  
  // Theme detection
  let isDarkMode = false;
  
  onMount(async () => {
    try {
      // Dynamic import for client-side only
      Chart = (await import('chart.js/auto')).default;
      isChartAvailable = true;
      
      // Detect current theme
      isDarkMode = document.documentElement.classList.contains('dark');
      
      // Watch for theme changes
      const observer = new MutationObserver(() => {
        const newDarkMode = document.documentElement.classList.contains('dark');
        if (newDarkMode !== isDarkMode) {
          isDarkMode = newDarkMode;
          // Update charts if the theme changes
          if (balanceHistory && balanceHistory.length > 0) {
            initOrUpdateBalanceChart();
            initOrUpdateTVLChart();
          }
        }
      });
      
      observer.observe(document.documentElement, { 
        attributes: true,
        attributeFilter: ['class']
      });
      
      // Initial fetch if a pool is already selected
      if (currentPool) {
        fetchBalanceHistoryData();
      }
      
      return () => {
        observer.disconnect();
      };
    } catch (error) {
      console.error('Failed to load Chart.js:', error);
      isChartAvailable = false;
    }
  });

  // Get the pool based on selected tokens
  $: currentPool = $liquidityStore.token0 && $liquidityStore.token1 
    ? $livePools.find(p => 
        (p.address_0 === $liquidityStore.token0?.canister_id && p.address_1 === $liquidityStore.token1?.canister_id) ||
        (p.address_1 === $liquidityStore.token0?.canister_id && p.address_0 === $liquidityStore.token1?.canister_id)
      )
    : null;
    
  let balanceHistory = [];
  let balanceChartCanvas;
  let balanceChartInstance;
  let tvlChartCanvas;
  let tvlChartInstance;
  let isLoading = false;
  let errorMessage = '';
  
  // Track token pair to avoid unnecessary refreshes
  let previousToken0Id = null;
  let previousToken1Id = null;
  
  // Only refresh chart when the pool or token pair changes, not on every amount change
  $: if (currentPool && isChartAvailable) {
    const token0Id = $liquidityStore.token0?.canister_id || null;
    const token1Id = $liquidityStore.token1?.canister_id || null;
    
    // Only fetch new data if tokens have changed
    if (token0Id !== previousToken0Id || token1Id !== previousToken1Id) {
      previousToken0Id = token0Id;
      previousToken1Id = token1Id;
      fetchBalanceHistoryData();
    } else if (balanceHistory.length > 0) {
      // Just update the existing charts with current token labels when amounts change
      // but don't fetch new data
      updateCharts();
    }
  }
  
  // Function to update charts without fetching new data
  function updateCharts() {
    // Use the improved methods with the flag to avoid recreating charts
    initOrUpdateBalanceChart(false);
    initOrUpdateTVLChart(false);
  }
  
  async function fetchBalanceHistoryData() {
    if (!currentPool) return;
    
    isLoading = true;
    errorMessage = '';
    
    try {
      // First try to get a numeric pool ID
      let poolId;
      
      // Check if the pool has a numeric ID property
      if (typeof currentPool.id === 'number') {
        poolId = currentPool.id;
      } else if (typeof currentPool.pool_id === 'number') {
        poolId = currentPool.pool_id;
      } else {
        errorMessage = 'Historical data unavailable for this pool';
        isLoading = false;
        return;
      }
      
      balanceHistory = await fetchPoolBalanceHistory(poolId);
      
      if (balanceHistory && balanceHistory.length > 0) {
        // Based on the example data from API response
        const sampleItem = balanceHistory[0];
        const expectedFields = [
          'pool_id', 'date', 'day_index', 'token_0_balance', 'token_1_balance', 
          'lp_token_supply', 'token_0_price_usd', 'token_1_price_usd', 'tvl_usd'
        ];
        
        const missingFields = expectedFields.filter(field => !(field in sampleItem));
        if (missingFields.length > 0) {
          console.error('Missing fields in API response:', missingFields);
          errorMessage = `Unexpected API response format. Missing fields: ${missingFields.join(', ')}`;
          return;
        }
        
        // Sort data by day_index to ensure chronological order
        balanceHistory.sort((a, b) => a.day_index - b.day_index);
        
        // Check if data has variations
        const hasSomeVariation = checkDataVariation(balanceHistory);
        console.log('Data has some variation:', hasSomeVariation);
        
        initOrUpdateBalanceChart();
        initOrUpdateTVLChart();
      } else {
        console.warn('No balance history data returned for pool ID:', poolId);
        errorMessage = 'No historical data available for this pool';
      }
    } catch (error) {
      console.error('Error fetching balance history:', error);
      errorMessage = `Failed to load chart data: ${error.message || 'Unknown error'}`;
    } finally {
      isLoading = false;
    }
  }
  
  // Function to check if data shows variation or is completely flat
  function checkDataVariation(data) {
    // Check for token 0
    const token0Variation = data.some((item, i) => {
      return i > 0 && Math.abs(item.token_0_balance - data[i-1].token_0_balance) > 0.00001;
    });
    
    // Check for token 1
    const token1Variation = data.some((item, i) => {
      return i > 0 && Math.abs(item.token_1_balance - data[i-1].token_1_balance) > 0.00001;
    });
    
    // Check for LP token supply
    const lpVariation = data.some((item, i) => {
      return i > 0 && Math.abs(item.lp_token_supply - data[i-1].lp_token_supply) > 0.00001;
    });
    
    return token0Variation || token1Variation || lpVariation;
  }
  
  function initOrUpdateBalanceChart(shouldReinitialize = true) {
    if (!balanceChartCanvas || !balanceHistory || balanceHistory.length === 0 || !isChartAvailable || !Chart) return;
    
    // If we're just updating labels but not recreating the entire chart
    if (!shouldReinitialize && balanceChartInstance) {
      balanceChartInstance.data.datasets[0].label = $liquidityStore.token0?.symbol || 'Token 0';
      balanceChartInstance.data.datasets[1].label = $liquidityStore.token1?.symbol || 'Token 1';
      balanceChartInstance.update('none'); // Minimal animation
      return;
    }
    
    // Clean up existing chart instance if it exists
    if (balanceChartInstance) {
      balanceChartInstance.destroy();
    }
    
    const ctx = balanceChartCanvas.getContext('2d');
    
    // Format dates for chart labels - dates are in YYYY-MM-DD format
    const labels = balanceHistory.map(entry => {
      return entry.date;
    });
    
    // Get the values directly from the API response
    const token0Data = balanceHistory.map(entry => entry.token_0_balance);
    const token1Data = balanceHistory.map(entry => entry.token_1_balance);
    
    // Find days with significant balance changes
    const significantChangePoints = [];
    balanceHistory.forEach((entry, index) => {
      if (index === 0) return; // Skip first day
      
      const prevEntry = balanceHistory[index - 1];
      const token0Change = entry.token_0_balance - prevEntry.token_0_balance;
      const token1Change = entry.token_1_balance - prevEntry.token_1_balance;
      
      // If there's a significant change (arbitrary threshold of 1%)
      if (Math.abs(token0Change) > prevEntry.token_0_balance * 0.01 || 
          Math.abs(token1Change) > prevEntry.token_1_balance * 0.01) {
        significantChangePoints.push({
          x: entry.date,
          y: entry.token_0_balance,
          change: {
            token0: token0Change,
            token1: token1Change
          }
        });
      }
    });
    
    // Check if token values are significantly different in scale
    const token0Max = Math.max(...token0Data);
    const token1Max = Math.max(...token1Data);
    const needsDualAxis = token0Max > token1Max * 3 || token1Max > token0Max * 3;
    
    // Create theme-aware gradients
    const token0Gradient = ctx.createLinearGradient(0, 0, 0, 250);
    token0Gradient.addColorStop(0, isDarkMode ? 'rgba(0, 149, 235, 0.2)' : 'rgba(0, 149, 235, 0.15)');
    token0Gradient.addColorStop(1, isDarkMode ? 'rgba(0, 149, 235, 0.02)' : 'rgba(0, 149, 235, 0.02)');
    
    const token1Gradient = ctx.createLinearGradient(0, 0, 0, 250);
    token1Gradient.addColorStop(0, isDarkMode ? 'rgba(0, 180, 115, 0.2)' : 'rgba(0, 180, 115, 0.15)');
    token1Gradient.addColorStop(1, isDarkMode ? 'rgba(0, 180, 115, 0.02)' : 'rgba(0, 180, 115, 0.02)');
    
    // Kong theme colors
    const token0Color = 'rgba(0, 149, 235, 1)'; // Kong blue
    const token1Color = 'rgba(0, 180, 115, 1)'; // Accent green
    const changePointColor = isDarkMode ? 'rgba(234, 67, 53, 1)' : 'rgba(220, 38, 38, 1)'; // Accent red
    
    // Tooltip styling
    const tooltipBgColor = isDarkMode ? 'rgba(20, 24, 38, 0.95)' : 'rgba(235, 244, 252, 0.95)';
    const tooltipBorderColor = isDarkMode ? 'rgba(35, 39, 53, 1)' : 'rgba(214, 226, 240, 1)';
    const tooltipTextColor = isDarkMode ? 'rgba(255, 255, 255, 1)' : 'rgba(15, 23, 42, 1)';
    
    balanceChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: $liquidityStore.token0?.symbol || 'Token 0',
            data: token0Data,
            borderColor: token0Color,
            backgroundColor: token0Gradient,
            borderWidth: 2,
            pointRadius: (ctx) => {
              // Highlight points with significant changes
              const index = ctx.dataIndex;
              if (index === 0 || index === token0Data.length - 1) return 4; // First and last points
              
              if (index > 0) {
                const change = Math.abs(token0Data[index] - token0Data[index - 1]);
                if (change > token0Data[index - 1] * 0.01) return 5; // Significant change
              }
              return 2; // Regular point
            },
            pointBackgroundColor: token0Color,
            pointBorderColor: isDarkMode ? 'rgba(13, 17, 31, 1)' : 'rgba(255, 255, 255, 1)',
            pointBorderWidth: 1.5,
            tension: 0.3, // Smoother curves
            fill: true,
            yAxisID: needsDualAxis && token0Max > token1Max * 3 ? 'y' : 'y'
          },
          {
            label: $liquidityStore.token1?.symbol || 'Token 1',
            data: token1Data,
            borderColor: token1Color,
            backgroundColor: token1Gradient,
            borderWidth: 2,
            pointRadius: (ctx) => {
              // Highlight points with significant changes
              const index = ctx.dataIndex;
              if (index === 0 || index === token1Data.length - 1) return 4; // First and last points
              
              if (index > 0) {
                const change = Math.abs(token1Data[index] - token1Data[index - 1]);
                if (change > token1Data[index - 1] * 0.01) return 5; // Significant change
              }
              return 2; // Regular point
            },
            pointBackgroundColor: token1Color,
            pointBorderColor: isDarkMode ? 'rgba(13, 17, 31, 1)' : 'rgba(255, 255, 255, 1)',
            pointBorderWidth: 1.5,
            tension: 0.3, // Smoother curves
            fill: true,
            yAxisID: needsDualAxis && token1Max > token0Max * 3 ? 'y1' : 'y'
          },
          // Highlight significant change points
          {
            label: 'Significant Changes',
            data: significantChangePoints,
            borderColor: changePointColor,
            backgroundColor: changePointColor,
            borderWidth: 0,
            pointRadius: 6,
            pointStyle: 'rectRot',
            pointBorderColor: isDarkMode ? 'rgba(13, 17, 31, 1)' : 'rgba(255, 255, 255, 1)',
            pointBorderWidth: 1.5,
            showLine: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            beginAtZero: false,
            grid: {
              display: false,
            },
            ticks: {
              display: false
            }
          },
          y1: {
            type: 'linear',
            display: needsDualAxis,
            position: 'right',
            beginAtZero: false,
            grid: {
              display: false,
            },
            ticks: {
              display: false
            }
          },
          x: {
            grid: {
              display: false,
            },
            ticks: {
              display: false
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            backgroundColor: tooltipBgColor,
            titleColor: tooltipTextColor,
            bodyColor: tooltipTextColor,
            borderColor: tooltipBorderColor,
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                
                // Special handling for significant change markers
                if (label.includes('Significant Changes')) {
                  return 'Significant balance change';
                }
                
                if (context.parsed.y !== null) {
                  // Format large numbers with commas for better readability
                  label += context.parsed.y.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  });
                }
                return label;
              },
              afterBody: function(context) {
                const index = context[0].dataIndex;
                const dayData = balanceHistory[index];
                
                if (!dayData) return null;
                
                let additionalInfo = `Day Index: ${dayData.day_index}\n`;
                
                // Add LP token supply info
                additionalInfo += `LP Token Supply: ${dayData.lp_token_supply.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}`;
                
                // Calculate changes from previous day if not the first day
                if (index > 0) {
                  const prevDay = balanceHistory[index - 1];
                  const token0Change = dayData.token_0_balance - prevDay.token_0_balance;
                  const token1Change = dayData.token_1_balance - prevDay.token_1_balance;
                  const lpChange = dayData.lp_token_supply - prevDay.lp_token_supply;
                  
                  if (Math.abs(token0Change) > 0.0001 || Math.abs(token1Change) > 0.0001 || Math.abs(lpChange) > 0.0001) {
                    additionalInfo += '\n\nChanges from previous day:';
                    
                    if (Math.abs(token0Change) > 0.0001) {
                      const percentChange = (token0Change / prevDay.token_0_balance) * 100;
                      additionalInfo += `\nToken 0: ${token0Change > 0 ? '+' : ''}${token0Change.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })} (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(2)}%)`;
                    }
                    
                    if (Math.abs(token1Change) > 0.0001) {
                      const percentChange = (token1Change / prevDay.token_1_balance) * 100;
                      additionalInfo += `\nToken 1: ${token1Change > 0 ? '+' : ''}${token1Change.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })} (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(2)}%)`;
                    }
                    
                    if (Math.abs(lpChange) > 0.0001) {
                      const percentChange = (lpChange / prevDay.lp_token_supply) * 100;
                      additionalInfo += `\nLP Supply: ${lpChange > 0 ? '+' : ''}${lpChange.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })} (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(2)}%)`;
                    }
                  }
                }
                
                return additionalInfo;
              }
            }
          }
        },
        animation: {
          duration: 800,
          easing: 'easeOutQuart'
        }
      }
    });
  }
  
  function initOrUpdateTVLChart(shouldReinitialize = true) {
    if (!tvlChartCanvas || !balanceHistory || balanceHistory.length === 0 || !isChartAvailable || !Chart) return;
    
    // If we're just updating without recreating the entire chart
    if (!shouldReinitialize && tvlChartInstance) {
      tvlChartInstance.update('none'); // Minimal animation
      return;
    }
    
    // Clean up existing chart instance if it exists
    if (tvlChartInstance) {
      tvlChartInstance.destroy();
    }
    
    const ctx = tvlChartCanvas.getContext('2d');
    
    // Now using the date field directly
    const labels = balanceHistory.map(entry => entry.date);
    
    // Use the TVL in USD value as the primary data point
    const tvlData = balanceHistory.map(entry => entry.tvl_usd);
    
    // Find days with significant TVL changes
    const significantChangePoints = [];
    balanceHistory.forEach((entry, index) => {
      if (index === 0) return; // Skip first day
      
      const prevEntry = balanceHistory[index - 1];
      const tvlChange = entry.tvl_usd - prevEntry.tvl_usd;
      
      // If there's a significant change (arbitrary threshold of 1%)
      if (Math.abs(tvlChange) > prevEntry.tvl_usd * 0.01) {
        significantChangePoints.push({
          x: entry.date,
          y: entry.tvl_usd,
          change: tvlChange
        });
      }
    });
    
    // Create theme-aware TVL gradient
    const tvlGradient = ctx.createLinearGradient(0, 0, 0, 300);
    tvlGradient.addColorStop(0, isDarkMode ? 'rgba(111, 93, 251, 0.25)' : 'rgba(111, 93, 251, 0.15)');
    tvlGradient.addColorStop(1, isDarkMode ? 'rgba(111, 93, 251, 0.02)' : 'rgba(111, 93, 251, 0.02)');
    
    // Theme colors
    const tvlColor = 'rgba(111, 93, 251, 1)'; // Accent purple
    const changePointColor = isDarkMode ? 'rgba(234, 67, 53, 1)' : 'rgba(220, 38, 38, 1)'; // Accent red
    
    // Tooltip styling
    const tooltipBgColor = isDarkMode ? 'rgba(20, 24, 38, 0.95)' : 'rgba(235, 244, 252, 0.95)';
    const tooltipBorderColor = isDarkMode ? 'rgba(35, 39, 53, 1)' : 'rgba(214, 226, 240, 1)';
    const tooltipTextColor = isDarkMode ? 'rgba(255, 255, 255, 1)' : 'rgba(15, 23, 42, 1)';
    
    tvlChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'TVL (USD)',
            data: tvlData,
            borderColor: tvlColor,
            backgroundColor: tvlGradient,
            borderWidth: 2,
            pointRadius: (ctx) => {
              // Highlight points with significant changes
              const index = ctx.dataIndex;
              if (index === 0 || index === tvlData.length - 1) return 4; // First and last points
              
              if (index > 0) {
                const change = Math.abs(tvlData[index] - tvlData[index - 1]);
                if (change > tvlData[index - 1] * 0.01) return 5; // Significant change
              }
              return 2; // Regular point
            },
            pointBackgroundColor: tvlColor,
            pointBorderColor: isDarkMode ? 'rgba(13, 17, 31, 1)' : 'rgba(255, 255, 255, 1)',
            pointBorderWidth: 1.5,
            tension: 0.3, // Smoother curves
            fill: true
          },
          // Highlight significant TVL changes
          {
            label: 'Significant TVL Changes',
            data: significantChangePoints,
            borderColor: changePointColor,
            backgroundColor: changePointColor,
            borderWidth: 0,
            pointRadius: 7,
            pointStyle: 'rectRot',
            pointBorderColor: isDarkMode ? 'rgba(13, 17, 31, 1)' : 'rgba(255, 255, 255, 1)',
            pointBorderWidth: 1.5,
            showLine: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          y: {
            beginAtZero: false,
            grid: {
              display: false,
            },
            ticks: {
              display: false
            }
          },
          x: {
            grid: {
              display: false,
            },
            ticks: {
              display: false
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            backgroundColor: tooltipBgColor,
            titleColor: tooltipTextColor,
            bodyColor: tooltipTextColor,
            borderColor: tooltipBorderColor,
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                
                // Special handling for significant change markers
                if (label.includes('Significant TVL Changes')) {
                  return 'Significant TVL change';
                }
                
                if (context.parsed.y !== null) {
                  // Format large numbers with dollar sign for TVL
                  label += '$' + context.parsed.y.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  });
                }
                return label;
              },
              afterBody: function(context) {
                const index = context[0].dataIndex;
                const dayData = balanceHistory[index];
                
                if (!dayData) return null;
                
                let additionalInfo = `Day Index: ${dayData.day_index}\n`;
                additionalInfo += `Date: ${dayData.date}\n`;
                additionalInfo += `Token 0 Balance: ${dayData.token_0_balance.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}\n`;
                additionalInfo += `Token 1 Balance: ${dayData.token_1_balance.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}\n`;
                
                // Add token price information
                additionalInfo += `Token 0 Price: $${dayData.token_0_price_usd.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6
                })}\n`;
                additionalInfo += `Token 1 Price: $${dayData.token_1_price_usd.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6
                })}`;
                
                // Calculate changes from previous day if not the first day
                if (index > 0) {
                  const prevDay = balanceHistory[index - 1];
                  const tvlChange = dayData.tvl_usd - prevDay.tvl_usd;
                  
                  if (Math.abs(tvlChange) > 0.01) {
                    const percentChange = (tvlChange / prevDay.tvl_usd) * 100;
                    additionalInfo += `\n\nTVL Change: ${tvlChange > 0 ? '+' : ''}$${Math.abs(tvlChange).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })} (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(2)}%)`;
                  }
                }
                
                return additionalInfo;
              }
            }
          }
        },
        animation: {
          duration: 800,
          easing: 'easeOutQuart'
        }
      }
    });
  }
</script>

<div class="charts-container">
  <Panel variant="transparent" className="!p-0 !overflow-visible">
    <div class="flex flex-col">
      <h3 class="chart-title flex items-center justify-between py-3 px-5">
        TVL History
        <div class="flex items-center gap-2">
          <div class="text-kong-text-primary/90">
            ${currentPool?.tvl ? formatBalance(currentPool.tvl, 6, 2) : '0.00'}
          </div>
          <button 
            class="refresh-btn"
            on:click={() => fetchBalanceHistoryData()} 
            disabled={isLoading}
            title="Refresh data">
            <span class:animate-spin={isLoading}>
              <RefreshCw class="w-4 h-4" />
            </span>
          </button>
        </div>
      </h3>
      <div class="chart-container" style="height: 280px;">
        {#if balanceHistory && balanceHistory.length > 0 && isChartAvailable}
          <canvas bind:this={tvlChartCanvas}></canvas>
        {:else}
          <div class="coming-soon">
            <BarChart3 class="mb-3 w-8 h-8" />
            {#if isLoading}
              Loading chart data...
            {:else if errorMessage}
              {errorMessage}
            {:else if !isChartAvailable}
              Charts unavailable - Could not load Chart.js
            {:else if currentPool}
              No chart data available
            {:else}
              Charts Coming Soon
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </Panel>

  <Panel variant="transparent" className="!p-0 !overflow-visible">
    <div class="flex flex-col">
      <h3 class="chart-title flex items-start justify-between py-3 px-5">
        Pool Balance
        <div class="text-kong-text-primary/90 flex items-center gap-2">
          {#if currentPool && $liquidityStore.token0 && $liquidityStore.token1}
            <div class="flex items-center gap-1">
              <span>{formatBalance(currentPool.balance_0, $liquidityStore.token0.decimals, 2)}</span>
              <span class="text-kong-text-accent-green/80 text-sm mt-1">{$liquidityStore.token0.symbol}</span>
            </div>
            <div class="flex items-center gap-1">
              <span>{formatBalance(currentPool.balance_1, $liquidityStore.token1.decimals, 2)}</span>
              <span class="text-kong-primary/80 text-sm mt-1">{$liquidityStore.token1.symbol}</span>
            </div>
          {:else}
            <div class="flex items-center gap-1">
              <span>0.00</span>
              <span class="text-kong-text-accent-green/80 text-sm mt-1">{$liquidityStore.token0?.symbol || '-'}</span>
            </div>
            <div class="flex items-center gap-1">
              <span>0.00</span>
              <span class="text-kong-primary/80 text-sm mt-1">{$liquidityStore.token1?.symbol || '-'}</span>
            </div>
          {/if}
        </div>
      </h3>
      <div class="chart-container" style="height: 280px;">
        {#if balanceHistory && balanceHistory.length > 0 && isChartAvailable}
          <canvas bind:this={balanceChartCanvas}></canvas>
        {:else}
          <div class="coming-soon">
            <BarChart3 class="mb-3 w-8 h-8" />
            {#if isLoading}
              Loading chart data...
            {:else if errorMessage}
              {errorMessage}
            {:else if !isChartAvailable}
              Charts unavailable - Could not load Chart.js
            {:else if currentPool}
              No chart data available
            {:else}
              Charts Coming Soon
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </Panel>
</div>

<style lang="postcss">
  .charts-container {
    @apply flex flex-col w-full gap-6;
  }

  .chart-title {
    @apply text-lg font-medium text-kong-text-primary/90;
  }

  .chart-container {
    @apply relative m-0 overflow-visible transition-all duration-300;
  }
  
  .chart-container canvas {
    @apply rounded-lg transition-all duration-300;
  }

  .coming-soon {
    @apply w-full h-full flex flex-col items-center justify-center text-kong-text-primary/60 text-lg font-medium;
  }
  
  .refresh-btn {
    @apply text-kong-text-primary/60 hover:text-kong-text-primary transition-colors duration-200;
  }
</style> 