type TableHeader = {
  label: string;
  column: string;
  textClass: string;
  requiresAuth?: boolean;
};

export const lpTableHeaders: TableHeader[] = [
  {
    label: 'stats.tokenHeader',
    column: 'token',
    textClass: 'text-left text-nowrap text-xl md:text-3xl',
  },
  {
    label: 'stats.priceHeader',
    column: 'price',
    textClass: 'text-right text-nowrap text-xl md:text-3xl',
  },
  {
    label: 'stats.tvlHeader',
    column: 'tvl',
    textClass: 'text-right text-nowrap text-xl md:text-3xl',
  },
  {
    label: 'stats.24hVolumeHeader',
    column: 'rolling_24h_volume',
    textClass: 'text-right text-nowrap text-xl md:text-3xl',
  },
  {
    label: 'stats.apyHeader',
    column: 'apy',
    textClass: 'text-right text-nowrap text-xl md:text-3xl',
  }
];

export const tokensTableHeaders: TableHeader[] = [
  { label: 'stats.tokenHeader', column: 'symbol', textClass: 'text-left text-nowrap text-xl md:text-3xl' },
  { label: 'stats.priceHeader', column: 'price', textClass: 'text-right text-nowrap text-xl md:text-3xl' },
  { label: 'stats.24hVolumeHeader', column: 'total_24h_volume', textClass: 'text-right text-nowrap text-xl md:text-3xl' },
  { label: 'stats.inWalletHeader', column: 'formattedUsdValue', requiresAuth: true, textClass: 'text-right text-nowrap text-xl md:text-3xl' },
];
