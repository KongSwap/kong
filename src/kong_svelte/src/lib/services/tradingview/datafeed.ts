import { INDEXER_URL } from '$lib/constants/canisterConstants';

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

export class KongDatafeed {
  private poolId: number | undefined;
  private lastBar: any = null;
  private lastError: Error | null = null;
  private errorRetryCount: number = 0;
  private readonly MAX_RETRIES = 3;

  constructor(poolId: number | undefined) {
    this.poolId = poolId;
    console.log('KongDatafeed initialized with poolId:', poolId);
  }

  onReady(callback: (configuration: any) => void): void {
    console.log('[onReady]: Method call');
    setTimeout(() => callback(configurationData));
  }

  searchSymbols(userInput: string, exchange: string, symbolType: string, onResult: (result: any[]) => void): void {
    console.log('[searchSymbols]: Method call');
    // Return empty since we only support one symbol per chart
    onResult([]);
  }

  resolveSymbol(symbolName: string, onSymbolResolvedCallback: (symbolInfo: any) => void, onError: (error: string) => void): void {
    console.log('[resolveSymbol]: Method call', symbolName);

    // Symbol information object
    const symbolInfo = {
      name: symbolName,
      ticker: symbolName,
      description: symbolName,
      type: 'crypto',
      session: '24x7',
      timezone: 'Etc/UTC',
      exchange: 'Kong',
      listed_exchange: 'Kong',
      format: 'price',
      minmov: 1,
      pricescale: 100000000,
      has_intraday: true,
      has_daily: true,
      has_weekly_and_monthly: true,
      supported_resolutions: configurationData.supported_resolutions,
      volume_precision: 8,
      data_status: 'streaming',
      currency_code: 'USD'
    };

    console.log('[resolveSymbol]: Symbol resolved', symbolName);
    onSymbolResolvedCallback(symbolInfo);
  }

  async getBars(
    symbolInfo: any,
    resolution: string,
    periodParams: {
      from: number;
      to: number;
      countBack: number;
      firstDataRequest: boolean;
    },
    onHistoryCallback: (bars: any[], meta: { noData?: boolean }) => void,
    onErrorCallback: (error: string) => void
  ): Promise<void> {
    try {
      if (!this.poolId) {
        onHistoryCallback([], { noData: true });
        return;
      }

      const fromMs = periodParams.from * 1000;
      const toMs = periodParams.to * 1000;
      
      const response = await fetch(
        `${INDEXER_URL}/pools/candlesticks/${this.poolId}?from=${fromMs}&to=${toMs}&resolution=${resolution}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data || !Array.isArray(data) || data.length === 0) {
        console.log('[getBars]: No data');
        onHistoryCallback([], { noData: true });
        return;
      }

      const bars = data.map(bar => ({
        time: Math.floor(new Date(bar.timestamp).getTime()),
        open: parseFloat(bar.open),
        high: parseFloat(bar.high),
        low: parseFloat(bar.low),
        close: parseFloat(bar.close),
        volume: parseFloat(bar.volume)
      }))
      .filter(bar => {
        // Validate bar data
        return !isNaN(bar.time) && 
               !isNaN(bar.open) && 
               !isNaN(bar.high) && 
               !isNaN(bar.low) && 
               !isNaN(bar.close) && 
               !isNaN(bar.volume) &&
               bar.time >= fromMs && 
               bar.time <= toMs;
      })
      .sort((a, b) => a.time - b.time);
      
      if (bars.length > 0) {
        this.lastBar = bars[bars.length - 1];
        this.lastError = null;
        this.errorRetryCount = 0;
      }
      
      onHistoryCallback(bars, { noData: bars.length === 0 });
    } catch (error) {
      console.error('[getBars]: Error', error);
      this.lastError = error as Error;
      this.errorRetryCount++;
      
      if (this.errorRetryCount <= this.MAX_RETRIES) {
        console.log(`[getBars]: Retrying (${this.errorRetryCount}/${this.MAX_RETRIES})`);
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.getBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback);
      } else {
        onErrorCallback(error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  subscribeBars(
    symbolInfo: any,
    resolution: string,
    onRealtimeCallback: (bar: any) => void,
    subscriberUID: string
  ): void {
    if (!this.poolId) {
      console.log('[subscribeBars]: No pool ID available');
      return;
    }

    console.log('[subscribeBars]: Method call with subscriberUID:', subscriberUID);
    
    const poll = async () => {
      if (!this.lastBar) return;

      try {
        const to = Math.floor(Date.now() / 1000);
        const from = Math.floor(this.lastBar.time / 1000);

        const response = await fetch(
          `${INDEXER_URL}/pools/candlesticks/${this.poolId}?from=${from * 1000}&to=${to * 1000}&resolution=${resolution}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (!data || !Array.isArray(data) || data.length === 0) return;

        const bars = data.map(bar => ({
          time: Math.floor(new Date(bar.timestamp).getTime()),
          open: parseFloat(bar.open),
          high: parseFloat(bar.high),
          low: parseFloat(bar.low),
          close: parseFloat(bar.close),
          volume: parseFloat(bar.volume)
        }))
        .filter(bar => {
          // Validate bar data
          return !isNaN(bar.time) && 
                 !isNaN(bar.open) && 
                 !isNaN(bar.high) && 
                 !isNaN(bar.low) && 
                 !isNaN(bar.close) && 
                 !isNaN(bar.volume);
        })
        .sort((a, b) => a.time - b.time);

        if (bars.length > 0 && bars[bars.length - 1].time > this.lastBar.time) {
          this.lastBar = bars[bars.length - 1];
          onRealtimeCallback(this.lastBar);
        }
      } catch (error) {
        console.error('[subscribeBars]: Error polling updates', error);
      }
    };

    const interval = setInterval(poll, 10000);
    (this as any)[subscriberUID] = interval;
  }

  unsubscribeBars(subscriberUID: string): void {
    console.log('[unsubscribeBars]: Method call with subscriberUID:', subscriberUID);
    const interval = (this as any)[subscriberUID];
    if (interval) {
      clearInterval(interval);
      delete (this as any)[subscriberUID];
    }
  }
} 