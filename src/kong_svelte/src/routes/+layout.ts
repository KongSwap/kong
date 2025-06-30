import type { LayoutLoad } from './$types';

// Enable prerendering for better SEO
export const prerender = true;

// Default values
const defaultTitle = 'KongSwap | Leading Multi-Chain DEX on Internet Computer';
const defaultDescription = 'Trade crypto with zero slippage on Internet Computer\'s premier DEX. Swap 50+ tokens, provide liquidity, earn rewards. 100% on-chain, DAO-governed DeFi platform.';
const defaultImage = 'https://kongswap.io/images/banner.jpg';

// Define metadata for specific routes
interface RouteMetadata {
  title: string;
  description: string;
  image: string;
  keywords?: string[];
}

const routeMetadata: Record<string, RouteMetadata> = {
  '': {
    title: 'KongSwap | #1 Multi-Chain DEX on Internet Computer - Swap, Earn & Trade DeFi',
    description: 'Trade crypto with zero slippage on Internet Computer\'s premier DEX. Swap 50+ tokens, provide liquidity, earn rewards. 100% on-chain, DAO-governed DeFi platform.',
    image: defaultImage,
    keywords: ['Internet Computer DEX', 'internet computer protocol', 'kong crypto', 'internet computer', 'ICP DeFi', 'ICP swap', 'ckBTC swap', 'ckETH swap', 'ICP trading', 'Internet Computer DeFi', 'DFINITY DEX', 'ICP prediction markets', 'ICP token exchange', 'icpswap', 'icp trading', 'internet computer trading', 'internet computer swap', 'dfinity swap', 'dfinity trading']
  },
  '/': {
    title: 'KongSwap | #1 Multi-Chain DEX on Internet Computer - Swap, Earn & Trade DeFi',
    description: 'Trade crypto with zero slippage on Internet Computer\'s premier DEX. Swap 50+ tokens, provide liquidity, earn rewards. 100% on-chain, DAO-governed DeFi platform.',
    image: defaultImage,
    keywords: ['Internet Computer DEX', 'internet computer protocol', 'kong crypto', 'internet computer', 'ICP DeFi', 'ICP swap', 'ckBTC swap', 'ckETH swap', 'ICP trading', 'Internet Computer DeFi', 'DFINITY DEX', 'ICP prediction markets', 'ICP token exchange', 'icpswap', 'icp trading', 'internet computer trading', 'internet computer swap', 'dfinity swap', 'dfinity trading']
  },
  '/predict': {
    title: 'Crypto Prediction Markets | Bet on Bitcoin, ICP & Real World Events - KongSwap',
    description: 'Trade prediction markets on crypto events. Bet on Bitcoin price, ICP adoption, Real World Events. Earn rewards by predicting market outcomes on Internet Computer.',
    image: 'https://kongswap.io/images/predictionmarket-og.jpg',
    keywords: ['ICP prediction markets', 'Bitcoin prediction markets', 'Internet Computer betting', 'Bitcoin prediction betting', 'DFINITY prediction markets', 'ckBTC price prediction', 'Internet Computer prediction betting', 'ICP prediction', 'btc prediction markets', 'crypto prediction markets', 'prediction markets Internet Computer', 'decentralized prediction markets']
  },
  '/swap': {
    title: 'Instant Token Swap | Trade 50+ Cryptos with Zero Slippage - KongSwap DEX',
    description: 'Swap ICP, Bitcoin, Ethereum & 50+ tokens instantly. Best rates, lowest fees (0.3%), zero slippage. Trade crypto seamlessly on Internet Computer\'s #1 DEX.',
    image: defaultImage,
    keywords: ['ICP token swap', 'ckBTC swap', 'Internet Computer exchange', 'ICP to Bitcoin swap', 'ckETH swap', 'DFINITY token exchange', 'ICP DeFi swap', 'Bitcoin swap Internet Computer', 'ICP ecosystem swap', 'chain key Bitcoin swap', 'ICRC token trading', 'ICP SNS token swap', 'ckBTC to ICP', 'Internet Computer token exchange', 'zero slippage trading ICP']
  },
  '/pools': {
    title: 'Liquidity Pools | Earn 25% APY Providing Liquidity - KongSwap DeFi',
    description: 'Become a liquidity provider and earn trading fees. Add liquidity to ICP, BTC, ETH pools. Earn up to 25% APY with impermanent loss protection on KongSwap.',
    image: defaultImage,
    keywords: ['ICP liquidity pools', 'ckBTC liquidity', 'Internet Computer liquidity provision', 'ICP liquidity rewards', 'Bitcoin liquidity provision', 'ICP DeFi pools', 'ckETH pools', 'Internet Computer LP tokens', 'ICP trading fees', 'DFINITY liquidity pools', 'chain key token liquidity', 'icpswap pools', 'icpswap liquidity',]
  },
  '/stats': {
    title: 'DeFi Analytics & TVL Stats | $100M+ Locked - KongSwap Dashboard',
    description: 'Track $100M+ TVL, daily volume, APY rates, and pool performance. Real-time DeFi analytics for Internet Computer\'s leading DEX. Make data-driven trading decisions.',
    image: defaultImage,
    keywords: ['ICP DeFi analytics', 'Internet Computer TVL', 'ckBTC volume', 'ICP ecosystem stats', 'DFINITY DeFi dashboard', 'ICP trading volume', 'Internet Computer DEX analytics', 'ckETH statistics', 'ICP market data', 'chain key token metrics', 'ICP swap analytics', 'prediction market statistics', 'Bitcoin swap volume']
  },
  '/airdrop-claims': {
    title: 'Claim KONG Airdrop | Free Tokens for Early Users - KongSwap Rewards',
    description: 'Claim your KONG token airdrop now. Early adopters, liquidity providers, and active traders eligible. Check eligibility and claim rewards worth $1000+.',
    image: defaultImage,
    keywords: ['KONG token airdrop', 'ICP airdrop', 'Internet Computer free tokens', 'ICP ecosystem rewards', 'Bitcoin DeFi airdrop', 'ckBTC rewards', 'ICP DeFi tokens', 'DFINITY airdrop', 'Internet Computer rewards', 'ICP trading rewards']
  },
  '/settings': {
    title: 'Account Settings | Customize Your Trading Experience - KongSwap',
    description: 'Configure slippage tolerance, gas preferences, and trading settings. Manage wallet connections, notifications, and security preferences on KongSwap DEX.',
    image: defaultImage,
    keywords: ['kongswap settings']
  },
  '/wallets': {
    title: 'Wallet Explorer | Track Portfolio & Transaction History - KongSwap',
    description: 'Explore any ICP wallet holdings, trading history, and LP positions. Track whale movements, analyze portfolios, and monitor DeFi activity on Internet Computer.',
    image: defaultImage,
    keywords: ['ICP wallet explorer', 'icp wallet tracker', 'Internet Computer portfolio', 'ICP transaction history', 'ckBTC wallet tracker', 'Internet Computer whale tracking', 'ICP DeFi analytics', 'DFINITY wallet analysis', 'ICP ecosystem tracking', 'ICP swap history']
  },
  '/pro': {
    title: 'KongSwap Pro | Advanced Trading Terminal for DeFi Professionals',
    description: 'Professional crypto trading with TradingView charts, limit orders, and advanced analytics. Built for DeFi traders who demand more. Trade like a pro on ICP.',
    image: defaultImage,
    keywords: ['ICP pro trading', 'Internet Computer advanced trading', 'ckBTC professional trading', 'ICP TradingView', 'Internet Computer limit orders', 'ICP DeFi terminal', 'DFINITY trading tools', 'Bitcoin ICP trading', 'ICP ecosystem trading']
  }
  // Add more routes as needed
};

// Function to find the best matching metadata for a given path
function getMetadataForPath(path: string) {
  // Check for exact match first
  if (routeMetadata[path]) {
    return routeMetadata[path];
  }
  
  // Find the most specific *startsWith* match (excluding exact match already checked)
  let bestMatch = null;
  let longestMatchLength = 0;
  
  for (const [route, metadata] of Object.entries(routeMetadata)) {
    if (path.startsWith(route) && route.length > longestMatchLength && route !== path) {
      bestMatch = metadata;
      longestMatchLength = route.length;
    }
  }

  if (bestMatch) {
    return bestMatch;
  }
  
  // Return defaults if no matches
  return {
    title: defaultTitle,
    description: defaultDescription,
    image: defaultImage,
    keywords: ['Internet Computer', 'ICP DeFi', 'ckBTC swap', 'DFINITY', 'Internet Computer ecosystem', 'ICP trading', 'chain key Bitcoin', 'ICP prediction markets', 'Bitcoin prediction markets', 'btc prediction markets', 'crypto prediction markets', 'decentralized prediction markets']
  };
}

export const load: LayoutLoad = ({ url }) => {
  const path = url.pathname;
  const metadata = getMetadataForPath(path);

  // Use the actual URL for the current environment
  const canonicalUrl = url.toString();

  return {
    metadata: {
      ...metadata,
      url: canonicalUrl,
      keywords: metadata.keywords || []
    }
  };
};