type TableHeader = {
  label: string;
  column: string;
  textClass: string;
};

export const lpTableHeaders: TableHeader[] = [
  {
    label: 'stats.poolName',
    column: 'poolName',
    textClass: 'text-left text-nowrap text-xl md:text-3xl',
  },
  {
    label: 'stats.price',
    column: 'price',
    textClass: 'text-right text-nowrap text-xl md:text-3xl',
  },
  {
    label: 'stats.tvl',
    column: 'tvl',
    textClass: 'text-right text-nowrap text-xl md:text-3xl',
  },
  {
    label: 'stats.24hVolume',
    column: 'rolling_24h_volume',
    textClass: 'text-right text-nowrap text-xl md:text-3xl',
  },
  {
    label: 'stats.apy',
    column: 'rolling_24h_apy',
    textClass: 'text-right text-nowrap text-xl md:text-3xl',
  },
];