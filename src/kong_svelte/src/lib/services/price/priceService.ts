import { writable, type Writable } from 'svelte/store';
import { fetchChartData, type CandleData } from '../indexer/api';

interface PriceState {
  currentPrice: number | null;
  price24hAgo: number | null;
  priceChange24h: number | null;
  candleData: CandleData[];
  lastUpdated: number | null;
}

interface PriceServiceConfig {
  payTokenId: number;
  receiveTokenId: number;
}

class PriceService {
  private store: Writable<PriceState>;
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private config: PriceServiceConfig | null = null;

  constructor() {
    this.store = writable<PriceState>({
      currentPrice: null,
      price24hAgo: null,
      priceChange24h: null,
      candleData: [],
      lastUpdated: null,
    });
  }

  async initialize(config: PriceServiceConfig) {
    // Clear any existing interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.config = config;
    await this.fetchPriceData();
    
    // Set up auto-refresh every minute
    this.updateInterval = setInterval(() => {
      this.fetchPriceData();
    }, 60 * 1000);
  }

  private async fetchPriceData() {
    if (!this.config) return;

    try {
      const now = Math.floor(Date.now() / 1000);
      const startTime = now - 2 * 24 * 60 * 60; // 48 hours ago

      const data = await fetchChartData(
        this.config.receiveTokenId, // USDT
        this.config.payTokenId,     // ICP
        startTime,
        now,
        "1D" // Daily candles
      );

      const filteredData = data.filter(
        (d) => d.close_price !== undefined && d.close_price !== null
      );

      if (filteredData.length >= 2) {
        // Sort by candle_start to ensure correct order
        const sortedData = [...filteredData].sort((a, b) => a.candle_start - b.candle_start);
        
        // Get the last two daily candles
        const currentPrice = Number(sortedData[sortedData.length - 1].close_price);
        const price24hAgo = Number(sortedData[sortedData.length - 2].close_price);
        
        console.log('Price Data:', {
          currentPrice,
          price24hAgo,
          currentCandleTime: new Date(sortedData[sortedData.length - 1].candle_start).toISOString(),
          prevCandleTime: new Date(sortedData[sortedData.length - 2].candle_start).toISOString(),
          numCandles: sortedData.length,
          tokenPair: `${this.config.receiveTokenId}/${this.config.payTokenId}`,
          allCandles: sortedData.map(d => ({
            time: new Date(d.candle_start).toISOString(),
            price: d.close_price
          }))
        });

        const priceChange24h = price24hAgo > 0
          ? ((currentPrice - price24hAgo) / price24hAgo) * 100
          : null;

        this.store.set({
          currentPrice,
          price24hAgo,
          priceChange24h,
          candleData: sortedData,
          lastUpdated: now,
        });
      }
    } catch (error) {
      console.error('Failed to fetch price data:', error);
    }
  }

  subscribe(callback: (state: PriceState) => void) {
    return this.store.subscribe(callback);
  }

  reset() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    this.config = null;
    this.store.set({
      currentPrice: null,
      price24hAgo: null,
      priceChange24h: null,
      candleData: [],
      lastUpdated: null,
    });
  }
}

// Helper functions
export function formatPriceChange(change: number | null): string {
  if (change === null) return '0.00%';
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}

export function getPriceChangeColor(change: number | null): string {
  if (change === null) return 'text-gray-400';
  return change >= 0 ? 'text-green-400' : 'text-red-400';
}

// Export singleton instance
export const priceStore = new PriceService(); 