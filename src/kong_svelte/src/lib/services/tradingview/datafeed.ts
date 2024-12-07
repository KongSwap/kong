import { INDEXER_URL } from '$lib/constants/canisterConstants';
import { fetchChartData } from '$lib/services/indexer/api';
import type { CandleData } from "$lib/services/indexer/api";

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
  private lastBar: Bar | null = null;

  constructor(fromTokenId: number, toTokenId: number) {
    this.fromTokenId = fromTokenId;
    this.toTokenId = toTokenId;
    console.log('KongDatafeed initialized with:', { fromTokenId, toTokenId });
  }

  onReady(callback: (configuration: any) => void): void {
    console.log('KongDatafeed.onReady called');
    setTimeout(() => callback({
      supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
      symbols_types: [{
        name: 'crypto',
        value: 'crypto'
      }]
    }), 0);
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
    periodParams: any,
    onHistoryCallback: (bars: Bar[], meta: { noData: boolean }) => void,
    onErrorCallback: (error: string) => void
  ): Promise<void> {
    try {
      console.log('KongDatafeed.getBars called with:', { 
        symbolInfo, 
        resolution, 
        periodParams,
        fromTokenId: this.fromTokenId,
        toTokenId: this.toTokenId
      });

      const data = await fetchChartData(
        this.fromTokenId,
        this.toTokenId,
        periodParams.from,
        periodParams.to,
        resolution
      );

      console.log('Received bar data:', { count: data.length, firstBar: data[0], lastBar: data[data.length - 1] });

      if (!data || data.length === 0) {
        onHistoryCallback([], { noData: true });
        return;
      }

      const bars = data.map(candle => ({
        time: new Date(candle.candle_start).getTime(),
        open: Number(candle.open_price),
        high: Number(candle.high_price),
        low: Number(candle.low_price),
        close: Number(candle.close_price),
        volume: Number(candle.volume)
      }));

      if (bars.length > 0) {
        this.lastBar = bars[bars.length - 1];
      }

      onHistoryCallback(bars, { noData: false });
    } catch (error) {
      console.error('Error fetching bars:', error);
      onErrorCallback(error.toString());
    }
  }

  subscribeBars(
    symbolInfo: any,
    resolution: string,
    onRealtimeCallback: (bar: Bar) => void,
    subscriberUID: string
  ): void {
    if (!this.fromTokenId || !this.toTokenId) {
      console.log('[subscribeBars]: No token IDs available');
      return;
    }

    console.log('[subscribeBars]: Method call with subscriberUID:', subscriberUID);
    
    const poll = async () => {
      if (!this.lastBar) return;

      try {
        const endTime = new Date().toISOString();
        const startTime = new Date(this.lastBar.time).toISOString();
        const interval = resolution === '60' ? '1h' : '1d';

        const url = `${INDEXER_URL}/api/swaps/ohlc?pay_token_id=${this.fromTokenId}&receive_token_id=${this.toTokenId}&start_time=${startTime}&end_time=${endTime}&interval=${interval}`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (!data || !Array.isArray(data) || data.length === 0) return;

        const bars = data.map(bar => ({
          time: Math.floor(new Date(bar.candle_start).getTime()),
          open: bar.open_price,
          high: bar.high_price,
          low: bar.low_price,
          close: bar.close_price,
          volume: bar.volume
        }))
        .filter(bar => {
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