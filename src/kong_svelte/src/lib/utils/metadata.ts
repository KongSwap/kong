interface MetadataParams {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  tags?: string[];
}

interface PageData {
  title: string;
  description: string;
  image: string;
  id: string;
}

const DEFAULT_METADATA: Required<MetadataParams> = {
  title: 'KongSwap | Leading Multi-Chain DEX on Internet Computer',
  description: 'Trade crypto with zero slippage on Internet Computer\'s premier DEX. Swap 50+ tokens, provide liquidity, earn rewards. 100% on-chain, DAO-governed DeFi platform.',
  image: 'https://kongswap.io/images/banner.jpg',
  url: 'https://kongswap.io',
  type: 'website',
  publishedTime: '',
  modifiedTime: '',
  author: 'KongSwap',
  section: '',
  tags: ['Internet Computer DEX', 'ICP DeFi', 'ckBTC swap', 'DFINITY', 'Internet Computer ecosystem', 'ICP trading', 'chain key Bitcoin', 'ICP prediction markets']
};

// Helper function to ensure absolute URLs
function ensureAbsoluteUrl(url: string, baseUrl = 'https://kongswap.io'): string {
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function generateMetadata(pathname: string, data?: PageData): MetadataParams {
  const baseUrl = import.meta.env.VITE_SITE_URL || 'https://kongswap.io';
  const cleanPath = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;

  // Dynamic pages with data
  if (data && cleanPath.startsWith('/predict/')) {
    return {
      ...DEFAULT_METADATA,
      title: data.title,
      description: data.description,
      image: ensureAbsoluteUrl(data.image, baseUrl),
      url: `${baseUrl}/predict/${data.id}`,
      type: 'article',
      publishedTime: new Date().toISOString(),
      section: 'Prediction Markets',
      tags: ['prediction market', 'betting', 'defi', ...DEFAULT_METADATA.tags]
    };
  }

  // Static routes
  const staticRoutes: Record<string, Partial<MetadataParams>> = {
    '/': {
      title: 'KongSwap | #1 Multi-Chain DEX on Internet Computer - Swap, Earn & Trade DeFi',
      description: 'Trade crypto with zero slippage on Internet Computer\'s premier DEX. Swap 50+ tokens, provide liquidity, earn rewards. 100% on-chain, DAO-governed DeFi platform.',
      tags: ['Internet Computer DEX', 'internet computer protocol', 'kong crypto', 'internet computer', 'ICP DeFi', 'ICP swap', 'ckBTC swap', 'ckETH swap', 'ICP trading', 'Internet Computer DeFi', 'DFINITY DEX', 'ICP prediction markets', 'ICP token exchange', 'icpswap', 'icp trading', 'internet computer trading', 'internet computer swap', 'dfinity swap', 'dfinity trading']
    },
    '/swap': {
      title: 'Instant Token Swap | Trade 50+ Cryptos with Zero Slippage - KongSwap DEX',
      description: 'Swap ICP, Bitcoin, Ethereum & 50+ tokens instantly. Best rates, lowest fees (0.3%), zero slippage. Trade crypto seamlessly on Internet Computer\'s #1 DEX.',
      tags: ['ICP token swap', 'ckBTC swap', 'Internet Computer exchange', 'ICP to Bitcoin swap', 'ckETH swap', 'DFINITY token exchange', 'ICP DeFi swap', 'Bitcoin swap Internet Computer', 'ICP ecosystem swap', 'chain key Bitcoin swap', 'ICRC token trading', 'ICP SNS token swap', 'ckBTC to ICP', 'Internet Computer token exchange', 'zero slippage trading ICP']
    },
    '/pro': {
      title: 'KongSwap Pro | Advanced Trading Terminal for DeFi Professionals',
      description: 'Professional crypto trading with TradingView charts, limit orders, and advanced analytics. Built for DeFi traders who demand more. Trade like a pro on ICP.',
      tags: ['ICP pro trading', 'Internet Computer advanced trading', 'ckBTC professional trading', 'ICP TradingView', 'Internet Computer limit orders', 'ICP DeFi terminal', 'DFINITY trading tools', 'Bitcoin ICP trading', 'ICP ecosystem trading']
    },
    '/pools': {
      title: 'Liquidity Pools | Earn 25% APY Providing Liquidity - KongSwap DeFi',
      description: 'Become a liquidity provider and earn trading fees. Add liquidity to ICP, BTC, ETH pools. Earn up to 25% APY with impermanent loss protection on KongSwap.',
      tags: ['ICP liquidity pools', 'ckBTC liquidity', 'Internet Computer liquidity provision', 'ICP liquidity rewards', 'Bitcoin liquidity provision', 'ICP DeFi pools', 'ckETH pools', 'Internet Computer LP tokens', 'ICP trading fees', 'DFINITY liquidity pools', 'chain key token liquidity', 'icpswap pools', 'icpswap liquidity']
    },
    '/predict': {
      title: 'Crypto Prediction Markets | Bet on Bitcoin, ICP & Real World Events - KongSwap',
      description: 'Trade prediction markets on crypto events. Bet on Bitcoin price, ICP adoption, Real World Events. Earn rewards by predicting market outcomes on Internet Computer.',
      image: 'https://kongswap.io/images/predictionmarket-og.jpg',
      tags: ['ICP prediction markets', 'Bitcoin prediction markets', 'Internet Computer betting', 'Bitcoin prediction betting', 'DFINITY prediction markets', 'ckBTC price prediction', 'Internet Computer prediction betting', 'ICP prediction', 'btc prediction markets', 'crypto prediction markets', 'prediction markets Internet Computer', 'decentralized prediction markets']
    }
  };

  const routeMetadata = staticRoutes[cleanPath === '' ? '/' : cleanPath];
  
  return {
    ...DEFAULT_METADATA,
    ...routeMetadata,
    url: `${baseUrl}${cleanPath === '/' ? '' : cleanPath}`
  };
}