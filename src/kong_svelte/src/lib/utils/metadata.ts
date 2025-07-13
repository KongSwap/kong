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

interface MarketData {
  title?: string;
  description?: string;
  imageUrl?: string;
  id?: string;
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

export function generateMetadata(pathname: string, data?: any): MetadataParams {
  const baseUrl = import.meta.env.VITE_SITE_URL || 'https://kongswap.io';
  
  // Clean up pathname
  const cleanPath = pathname.endsWith('/') && pathname !== '/' 
    ? pathname.slice(0, -1) 
    : pathname;
  
  // Route-specific metadata with SEO-optimized content
  switch (true) {
    // Home page
    case cleanPath === '/' || cleanPath === '':
      return {
        ...DEFAULT_METADATA,
        title: 'KongSwap | #1 Multi-Chain DEX on Internet Computer - Swap, Earn & Trade DeFi',
        description: 'Trade crypto with zero slippage on Internet Computer\'s premier DEX. Swap 50+ tokens, provide liquidity, earn rewards. 100% on-chain, DAO-governed DeFi platform.',
        url: baseUrl,
        tags: ['Internet Computer DEX', 'internet computer protocol', 'kong crypto', 'internet computer', 'ICP DeFi', 'ICP swap', 'ckBTC swap', 'ckETH swap', 'ICP trading', 'Internet Computer DeFi', 'DFINITY DEX', 'ICP prediction markets', 'ICP token exchange', 'icpswap', 'icp trading', 'internet computer trading', 'internet computer swap', 'dfinity swap', 'dfinity trading']
      };
    
    // Swap page
    case cleanPath === '/swap':
      return {
        ...DEFAULT_METADATA,
        title: 'Instant Token Swap | Trade 50+ Cryptos with Zero Slippage - KongSwap DEX',
        description: 'Swap ICP, Bitcoin, Ethereum & 50+ tokens instantly. Best rates, lowest fees (0.3%), zero slippage. Trade crypto seamlessly on Internet Computer\'s #1 DEX.',
        url: `${baseUrl}/swap`,
        tags: ['ICP token swap', 'ckBTC swap', 'Internet Computer exchange', 'ICP to Bitcoin swap', 'ckETH swap', 'DFINITY token exchange', 'ICP DeFi swap', 'Bitcoin swap Internet Computer', 'ICP ecosystem swap', 'chain key Bitcoin swap', 'ICRC token trading', 'ICP SNS token swap', 'ckBTC to ICP', 'Internet Computer token exchange', 'zero slippage trading ICP']
      };
    
    // Pro trading
    case cleanPath === '/pro':
      return {
        ...DEFAULT_METADATA,
        title: 'KongSwap Pro | Advanced Trading Terminal for DeFi Professionals',
        description: 'Professional crypto trading with TradingView charts, limit orders, and advanced analytics. Built for DeFi traders who demand more. Trade like a pro on ICP.',
        url: `${baseUrl}/pro`,
        tags: ['ICP pro trading', 'Internet Computer advanced trading', 'ckBTC professional trading', 'ICP TradingView', 'Internet Computer limit orders', 'ICP DeFi terminal', 'DFINITY trading tools', 'Bitcoin ICP trading', 'ICP ecosystem trading']
      };
    
    // Liquidity pools
    case cleanPath === '/pools':
      return {
        ...DEFAULT_METADATA,
        title: 'Liquidity Pools | Earn 25% APY Providing Liquidity - KongSwap DeFi',
        description: 'Become a liquidity provider and earn trading fees. Add liquidity to ICP, BTC, ETH pools. Earn up to 25% APY with impermanent loss protection on KongSwap.',
        url: `${baseUrl}/pools`,
        tags: ['ICP liquidity pools', 'ckBTC liquidity', 'Internet Computer liquidity provision', 'ICP liquidity rewards', 'Bitcoin liquidity provision', 'ICP DeFi pools', 'ckETH pools', 'Internet Computer LP tokens', 'ICP trading fees', 'DFINITY liquidity pools', 'chain key token liquidity', 'icpswap pools', 'icpswap liquidity']
      };
    
    // Stats
    case cleanPath === '/stats':
      return {
        ...DEFAULT_METADATA,
        title: 'DeFi Analytics & TVL Stats | $100M+ Locked - KongSwap Dashboard',
        description: 'Track $100M+ TVL, daily volume, APY rates, and pool performance. Real-time DeFi analytics for Internet Computer\'s leading DEX. Make data-driven trading decisions.',
        url: `${baseUrl}/stats`,
        tags: ['ICP DeFi analytics', 'Internet Computer TVL', 'ckBTC volume', 'ICP ecosystem stats', 'DFINITY DeFi dashboard', 'ICP trading volume', 'Internet Computer DEX analytics', 'ckETH statistics', 'ICP market data', 'chain key token metrics', 'ICP swap analytics', 'prediction market statistics', 'Bitcoin swap volume']
      };
    
    // Airdrop claims
    case cleanPath === '/airdrop-claims':
      return {
        ...DEFAULT_METADATA,
        title: 'Claim KONG Airdrop | Free Tokens for Early Users - KongSwap Rewards',
        description: 'Claim your KONG token airdrop now. Early adopters, liquidity providers, and active traders eligible. Check eligibility and claim rewards worth $1000+.',
        url: `${baseUrl}/airdrop-claims`,
        tags: ['KONG token airdrop', 'ICP airdrop', 'Internet Computer free tokens', 'ICP ecosystem rewards', 'Bitcoin DeFi airdrop', 'ckBTC rewards', 'ICP DeFi tokens', 'DFINITY airdrop', 'Internet Computer rewards', 'ICP trading rewards']
      };
    
    // Settings
    case cleanPath === '/settings':
      return {
        ...DEFAULT_METADATA,
        title: 'Account Settings | Customize Your Trading Experience - KongSwap',
        description: 'Configure slippage tolerance, gas preferences, and trading settings. Manage wallet connections, notifications, and security preferences on KongSwap DEX.',
        url: `${baseUrl}/settings`,
        tags: ['kongswap settings']
      };
    
    // Wallet explorer
    case cleanPath === '/wallets':
      return {
        ...DEFAULT_METADATA,
        title: 'Wallet Explorer | Track Portfolio & Transaction History - KongSwap',
        description: 'Explore any ICP wallet holdings, trading history, and LP positions. Track whale movements, analyze portfolios, and monitor DeFi activity on Internet Computer.',
        url: `${baseUrl}/wallets`,
        tags: ['ICP wallet explorer', 'icp wallet tracker', 'Internet Computer portfolio', 'ICP transaction history', 'ckBTC wallet tracker', 'Internet Computer whale tracking', 'ICP DeFi analytics', 'DFINITY wallet analysis', 'ICP ecosystem tracking', 'ICP swap history']
      };
    
    // Add liquidity
    case cleanPath === '/add':
      return {
        ...DEFAULT_METADATA,
        title: 'Add Liquidity - KongSwap',
        description: 'Add liquidity to KongSwap pools and earn trading fees. Support the ecosystem while earning rewards.',
        url: `${baseUrl}/add`
      };
    
    // Predictions market list
    case cleanPath === '/predict':
      return {
        ...DEFAULT_METADATA,
        title: 'Crypto Prediction Markets | Bet on Bitcoin, ICP & Real World Events - KongSwap',
        description: 'Trade prediction markets on crypto events. Bet on Bitcoin price, ICP adoption, Real World Events. Earn rewards by predicting market outcomes on Internet Computer.',
        image: 'https://kongswap.io/images/predictionmarket-og.jpg',
        url: `${baseUrl}/predict`,
        tags: ['ICP prediction markets', 'Bitcoin prediction markets', 'Internet Computer betting', 'Bitcoin prediction betting', 'DFINITY prediction markets', 'ckBTC price prediction', 'Internet Computer prediction betting', 'ICP prediction', 'btc prediction markets', 'crypto prediction markets', 'prediction markets Internet Computer', 'decentralized prediction markets']
      };
    
    // Individual prediction market
    case cleanPath.startsWith('/predict/'):
      const market = data as MarketData;
      return {
        ...DEFAULT_METADATA,
        title: market?.title || 'Prediction Market - KongSwap',
        description: market?.description || 'Trade on this prediction market. Make informed predictions and earn rewards.',
        image: market?.imageUrl || DEFAULT_METADATA.image,
        url: `${baseUrl}/predict/${market?.id || 'market'}`,
        type: 'article',
        publishedTime: new Date().toISOString(),
        section: 'Prediction Markets',
        tags: ['prediction market', 'betting', 'defi', ...(DEFAULT_METADATA.tags || [])]
      };
    
    // Default fallback
    default:
      return {
        ...DEFAULT_METADATA,
        url: `${baseUrl}${cleanPath}`
      };
  }
}

// Helper function to ensure absolute URLs for images
export function ensureAbsoluteUrl(url: string | undefined, baseUrl: string): string {
  if (!url) return DEFAULT_METADATA.image;
  
  // Already absolute
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Protocol-relative
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  
  // Relative URL
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

// Helper to generate structured data based on page type
export function generateStructuredData(metadata: MetadataParams, pathname: string): any {
  const baseStructure = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'KongSwap',
    url: metadata.url,
    description: metadata.description
  };
  
  // Add specific structured data for different page types
  if (pathname.startsWith('/predict/') && metadata.type === 'article') {
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: metadata.title,
      description: metadata.description,
      image: metadata.image,
      datePublished: metadata.publishedTime,
      dateModified: metadata.modifiedTime || metadata.publishedTime,
      author: {
        '@type': 'Organization',
        name: metadata.author
      },
      publisher: {
        '@type': 'Organization',
        name: 'KongSwap',
        logo: {
          '@type': 'ImageObject',
          url: 'https://kongswap.io/favicon/favicon-128x128.png'
        }
      }
    };
  }
  
  return baseStructure;
}