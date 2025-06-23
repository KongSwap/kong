import type { LayoutLoad } from './$types';

// Enable prerendering for better SEO
export const prerender = true;

// Default values
const defaultTitle = 'KongSwap | Leading Multi-Chain DEX on Internet Computer';
const defaultDescription = 'Trade crypto with zero slippage on Internet Computer\'s premier DEX. Swap 50+ tokens, provide liquidity, earn rewards. 100% on-chain, DAO-governed DeFi platform.';
const defaultImage = 'https://kongswap.io/images/banner.webp';

// Define metadata for specific routes
const routeMetadata = {
  '': {
    title: 'KongSwap | #1 Multi-Chain DEX on Internet Computer - Swap, Earn & Trade DeFi',
    description: 'Trade crypto with zero slippage on Internet Computer\'s premier DEX. Swap 50+ tokens, provide liquidity, earn rewards. 100% on-chain, DAO-governed DeFi platform.',
    image: defaultImage 
  },
  '/': {
    title: 'KongSwap | #1 Multi-Chain DEX on Internet Computer - Swap, Earn & Trade DeFi',
    description: 'Trade crypto with zero slippage on Internet Computer\'s premier DEX. Swap 50+ tokens, provide liquidity, earn rewards. 100% on-chain, DAO-governed DeFi platform.',
    image: defaultImage 
  },
  '/home': {
    title: 'KongSwap | #1 Multi-Chain DEX on Internet Computer - Swap, Earn & Trade DeFi',
    description: 'Trade crypto with zero slippage on Internet Computer\'s premier DEX. Swap 50+ tokens, provide liquidity, earn rewards. 100% on-chain, DAO-governed DeFi platform.',
    image: defaultImage 
  },
  '/predict': {
    title: 'Crypto Prediction Markets | Bet on Bitcoin, ICP & DeFi Outcomes - KongSwap',
    description: 'Trade prediction markets on crypto events. Bet on Bitcoin price, ICP adoption, DeFi trends. Earn rewards by predicting market outcomes on Internet Computer.',
    image: 'https://kongswap.io/images/predictionmarket-og.png'
  },
  '/swap': {
    title: 'Instant Token Swap | Trade 50+ Cryptos with Zero Slippage - KongSwap DEX',
    description: 'Swap ICP, Bitcoin, Ethereum & 50+ tokens instantly. Best rates, lowest fees (0.3%), zero slippage. Trade crypto seamlessly on Internet Computer\'s #1 DEX.',
    image: defaultImage
  },
  '/pools': {
    title: 'Liquidity Pools | Earn 25% APY Providing Liquidity - KongSwap DeFi',
    description: 'Become a liquidity provider and earn trading fees. Add liquidity to ICP, BTC, ETH pools. Earn up to 25% APY with impermanent loss protection on KongSwap.',
    image: defaultImage
  },
  '/stats': {
    title: 'DeFi Analytics & TVL Stats | $100M+ Locked - KongSwap Dashboard',
    description: 'Track $100M+ TVL, daily volume, APY rates, and pool performance. Real-time DeFi analytics for Internet Computer\'s leading DEX. Make data-driven trading decisions.',
    image: defaultImage
  },
  '/airdrop-claims': {
    title: 'Claim KONG Airdrop | Free Tokens for Early Users - KongSwap Rewards',
    description: 'Claim your KONG token airdrop now. Early adopters, liquidity providers, and active traders eligible. Check eligibility and claim rewards worth $1000+.',
    image: defaultImage
  },
  '/settings': {
    title: 'Account Settings | Customize Your Trading Experience - KongSwap',
    description: 'Configure slippage tolerance, gas preferences, and trading settings. Manage wallet connections, notifications, and security preferences on KongSwap DEX.',
    image: defaultImage
  },
  '/wallets': {
    title: 'Wallet Explorer | Track Portfolio & Transaction History - KongSwap',
    description: 'Explore any ICP wallet holdings, trading history, and LP positions. Track whale movements, analyze portfolios, and monitor DeFi activity on Internet Computer.',
    image: defaultImage
  },
  '/pro': {
    title: 'KongSwap Pro | Advanced Trading Terminal for DeFi Professionals',
    description: 'Professional crypto trading with TradingView charts, limit orders, and advanced analytics. Built for DeFi traders who demand more. Trade like a pro on ICP.',
    image: defaultImage
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
    image: defaultImage
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
      url: canonicalUrl
    }
  };
};