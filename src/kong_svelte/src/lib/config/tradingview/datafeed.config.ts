import { fetchChartData } from '$lib/api/transactions';

// Configuration for the datafeed
const configurationData = {
  supported_resolutions: ['1', '5', '15', '30', '60', '240', 'D', 'W', 'M'],
  exchanges: [
    { value: 'Kong', name: 'Kong', desc: 'Kong DEX' }
  ],
  symbols_types: [
    { name: 'crypto', value: 'crypto' }
  ],
  supports_marks: false,
  supports_timescale_marks: false,
  supports_time: true,
  currency_codes: ['USD'],
  has_intraday: true,
  intraday_multipliers: ['1', '5', '15', '30', '60', '240'],
  has_daily: true,
  has_weekly_and_monthly: true
};

interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class KongDatafeed {
  private fromTokenId: number;
  private toTokenId: number;
  public lastBar: Bar | null = null;
  private currentPrice: number;
  private onRealtimeCallback: ((bar: Bar) => void) | null = null;
  private fromTokenDecimals: number;
  private toTokenDecimals: number;

  constructor(fromTokenId: number, toTokenId: number, currentPrice: number, fromTokenDecimals: number = 8, toTokenDecimals: number = 8) {
    this.fromTokenId = fromTokenId;
    this.toTokenId = toTokenId;
    this.currentPrice = currentPrice;
    this.fromTokenDecimals = fromTokenDecimals;
    this.toTokenDecimals = toTokenDecimals;
  }

  onReady(callback: (configuration: any) => void): void {
    setTimeout(() => callback({
      supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
      symbols_types: [{
        name: 'crypto',
        value: 'crypto'
      }]
    }), 0);
  }

  searchSymbols(userInput: string, exchange: string, symbolType: string, onResult: (result: any[]) => void): void {
    // Return empty since we only support one symbol per chart
    onResult([]);
  }

  resolveSymbol(symbolName: string, onSymbolResolvedCallback: (symbolInfo: any) => void, onError: (error: string) => void): void {
    // Calculate price scale based on current price and token decimals, consistent with statsUtils
    const getPriceScale = (price: number) => {
      const adjustedPrice = price * Math.pow(10, this.toTokenDecimals - this.fromTokenDecimals);
      
      // Consistent with minMove from statsUtils:
      // If adjustedPrice >= 1000, minMove = 0.000001 => pricescale = 1 / 0.000001 = 1,000,000
      // Otherwise, minMove = 0.00000001 => pricescale = 1 / 0.00000001 = 100,000,000
      return adjustedPrice >= 1000 ? 1000000 : 100000000; 
    };

    // Symbol information object
    const symbolInfo = {
      name: symbolName,
      ticker: symbolName,
      description: symbolName,
      type: 'crypto',
      session: '24x7',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Etc/UTC',
      exchange: 'Kong',
      listed_exchange: 'Kong',
      format: 'price',
      minmov: 1,
      pricescale: getPriceScale(this.currentPrice),
      has_intraday: true,
      has_daily: true,
      has_weekly_and_monthly: true,
      supported_resolutions: configurationData.supported_resolutions,
      volume_precision: 8,
      data_status: 'streaming',
      currency_code: 'USD',
      // Add explicit formatting options to prevent the split error
      minmove2: 0,
      fractional: false
    };
        
    // Use setTimeout to make the callback asynchronous as required by TradingView
    setTimeout(() => {
      onSymbolResolvedCallback(symbolInfo);
    }, 0);
  }

  async getBars(
    symbolInfo: any,
    resolution: string,
    periodParams: any,
    onHistoryCallback: (bars: Bar[], meta: { noData: boolean }) => void,
    onErrorCallback: (error: string) => void
  ): Promise<void> {
    console.log("[Datafeed] getBars called with:", { 
      symbol: symbolInfo.name, 
      resolution, 
      from: new Date(periodParams.from * 1000).toISOString(), 
      to: new Date(periodParams.to * 1000).toISOString(),
      fromTokenId: this.fromTokenId,
      toTokenId: this.toTokenId
    });
    
    try {
      const data = await fetchChartData(
        this.fromTokenId,
        this.toTokenId,
        periodParams.from,
        periodParams.to,
        resolution
      );

      console.log("[Datafeed] Fetched data:", { 
        dataLength: data?.length || 0, 
        firstBar: data?.[0], 
        lastBar: data?.[data?.length - 1] 
      });

      if (!data || data.length === 0) {
        console.warn("[Datafeed] No data received");
        onHistoryCallback([], { noData: true });
        return;
      }

      // Convert and validate the bars
      const bars = data
        .map(candle => ({
          time: candle.candle_start,
          open: Number(candle.open_price),
          high: Number(candle.high_price),
          low: Number(candle.low_price),
          close: Number(candle.close_price),
          volume: Number(candle.volume)
        }))
        .filter((bar): bar is Bar => 
          bar !== null && 
          !isNaN(bar.open) && 
          !isNaN(bar.high) && 
          !isNaN(bar.low) && 
          !isNaN(bar.close) && 
          !isNaN(bar.volume)
        )
        // Sort bars by timestamp in ascending order
        .sort((a, b) => a.time - b.time);

      // Validate time sequence
      const validBars = bars.filter((bar, index) => {
        if (index === 0) return true;
        return bar.time > bars[index - 1].time;
      });

      if (validBars.length > 0) {
        this.lastBar = validBars[validBars.length - 1];
      }

      onHistoryCallback(validBars, { noData: validBars.length === 0 });
    } catch (error) {
      console.error('Error fetching bars:', error);
      onErrorCallback(error.toString());
    }
  }

  getPrice(): number {
    return this.lastBar ? this.lastBar.close : 0;
  }

  subscribeBars(
    symbolInfo: any,
    resolution: string,
    onRealtimeCallback: (bar: Bar) => void,
    subscriberUID: string
  ): void {
    this.onRealtimeCallback = onRealtimeCallback;  // Store callback for price updates
    
    if (!this.fromTokenId || !this.toTokenId) {
        console.warn('Missing token IDs:', { fromTokenId: this.fromTokenId, toTokenId: this.toTokenId });
        return;
    }
    
    const poll = async () => {
        try {
            const now = Math.floor(Date.now() / 1000);
            // Get data starting from the last known bar time, or 5 minutes ago if no last bar
            const startTime = this.lastBar 
                ? Math.floor(this.lastBar.time / 1000)  // Convert ms to seconds
                : now - 300;

            const data = await fetchChartData(
                this.fromTokenId,
                this.toTokenId,
                startTime,
                now,
                resolution
            );

            if (!data || data.length === 0) return;

            const bars = data
                .map(candle => ({
                    time: candle.candle_start,
                    open: Number(candle.open_price),
                    high: Number(candle.high_price),
                    low: Number(candle.low_price),
                    close: Number(candle.close_price),
                    volume: Number(candle.volume)
                }))
                .filter((bar): bar is Bar => 
                    bar !== null && 
                    !isNaN(bar.open) && 
                    !isNaN(bar.high) && 
                    !isNaN(bar.low) && 
                    !isNaN(bar.close) && 
                    !isNaN(bar.volume)
                )
                .sort((a, b) => a.time - b.time);

            if (bars.length > 0) {
                const latestBar = bars[bars.length - 1];

                // If we don't have a last bar or this is a new bar
                if (!this.lastBar || latestBar.time > this.lastBar.time) {
                    this.lastBar = latestBar;
                    onRealtimeCallback(latestBar);
                } 
                // If this is an update to the current bar
                else if (latestBar.time === this.lastBar.time && 
                    (latestBar.close !== this.lastBar.close || 
                     latestBar.high !== this.lastBar.high || 
                     latestBar.low !== this.lastBar.low || 
                     latestBar.volume !== this.lastBar.volume)) {
                    this.lastBar = latestBar;
                    onRealtimeCallback(latestBar);
                }
            }
        } catch (error) {
            console.error('[subscribeBars]: Error polling updates', error);
        }
    };

    const interval = setInterval(poll, 10000);
    (this as any)[subscriberUID] = interval;
  }

  unsubscribeBars(subscriberUID: string): void {
    const interval = (this as any)[subscriberUID];
    if (interval) {
      clearInterval(interval);
      delete (this as any)[subscriberUID];
    }
  }

  public updateCurrentPrice(newPrice: number) {
    if (newPrice === this.currentPrice) return;
    
    // Check if we need to update the price scale (crossing threshold)
    const needsPriceScaleUpdate = 
      (this.currentPrice >= 1000 && newPrice < 1000) ||
      (this.currentPrice < 1000 && newPrice >= 1000) ||
      (this.currentPrice >= 1 && newPrice < 1) ||
      (this.currentPrice < 1 && newPrice >= 1);
    
    this.currentPrice = newPrice;
    
    if (needsPriceScaleUpdate) {
      console.warn(`Price crossed threshold (${this.currentPrice}), chart may need refresh for proper decimal display`);
      // The chart will need to be reinitialized to show the correct decimal places
      // This is handled by the component when it detects significant price changes
    }
    
    if (this.lastBar && this.onRealtimeCallback) {
      const updatedBar = {
        ...this.lastBar,
        high: Math.max(this.lastBar.high, newPrice),
        low: Math.min(this.lastBar.low, newPrice),
        close: newPrice,
        open: this.lastBar.open,
        volume: this.lastBar.volume
      };
      
      this.lastBar = updatedBar;
      this.onRealtimeCallback(updatedBar);
    } else {
      console.warn('No lastBar or callback available', {
        hasLastBar: !!this.lastBar,
        hasCallback: !!this.onRealtimeCallback
      });
    }
  }
} 