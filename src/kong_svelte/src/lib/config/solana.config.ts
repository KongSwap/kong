import { Connection } from '@solana/web3.js';

// Solana mainnet endpoints - using QuickNode for reliable access
const SOLANA_ENDPOINTS = [
  'https://purple-alpha-sailboat.solana-mainnet.quiknode.pro/845b0fef2cd29d83ef7a398f6028fa3a95d63e2b/',
  'https://api.mainnet-beta.solana.com', // Fallback to official mainnet
];

/**
 * Get a working Solana connection
 */
export const getSolanaConnection = async (): Promise<Connection> => {
  for (const endpoint of SOLANA_ENDPOINTS) {
    try {
      console.log(`🔄 Trying to connect to ${endpoint}...`);
      const connection = new Connection(endpoint, 'confirmed');
      
      // Test the connection with a simple call
      await connection.getVersion();
      console.log(`✅ Successfully connected to ${endpoint}`);
      return connection;
    } catch (error) {
      console.warn(`⚠️ Failed to connect to ${endpoint}:`, error instanceof Error ? error.message : 'Unknown error');
      continue;
    }
  }
  
  throw new Error('❌ All Solana endpoints failed to connect');
};

export interface SolanaTokenInfo {
  id: number;
  symbol: string;
  decimals: number;
  mint_address: string;
  name: string;
  logo_url: string;
  chain: string;
}

export const DEFAULT_SOLANA_TOKENS: SolanaTokenInfo[] = [
  { id: 3, symbol: "USDC", decimals: 6, mint_address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", name: "USD Coin", logo_url: "/tokens/solana/usdc.webp", chain: "Solana" },
  { id: 7, symbol: "TRUMP", decimals: 6, mint_address: "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN", name: "TRUMP", logo_url: "/tokens/solana/trump.png", chain: "Solana" },
  { id: 8, symbol: "SOL", decimals: 9, mint_address: "So11111111111111111111111111111111111111112", name: "Solana", logo_url: "/tokens/solana/solana.png", chain: "Solana" }
];

export interface SolanaBalance {
  mint_address: string;
  balance: bigint;
  balance_formatted: string;
  usd_value: string;
}

/**
 * Get Solana token balances for a given address
 */
export const getSolanaBalances = async (walletAddress: string): Promise<SolanaBalance[]> => {
  try {
    const connection = await getSolanaConnection();
    const { PublicKey } = await import('@solana/web3.js');
    
    // Fetch token prices
    const { CrossChainSwapService } = await import('$lib/services/swap/CrossChainSwapService');
    const prices = await CrossChainSwapService.fetchTokenPrices();
    
    const publicKey = new PublicKey(walletAddress);
    const balances: SolanaBalance[] = [];
    
    // Get SOL balance
    const solBalance = await connection.getBalance(publicKey);
    const solFormatted = (solBalance / 1e9);
    const solUsdValue = solFormatted * (prices.SOL || 162);
    
    balances.push({
      mint_address: "So11111111111111111111111111111111111111112",
      balance: BigInt(solBalance),
      balance_formatted: solFormatted.toFixed(6),
      usd_value: solUsdValue.toFixed(2)
    });
    
    // Get SPL token balances
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
      programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
    });
    
    for (const account of tokenAccounts.value) {
      const tokenInfo = account.account.data.parsed.info;
      const mintAddress = tokenInfo.mint;
      const balance = BigInt(tokenInfo.tokenAmount.amount);
      const decimals = tokenInfo.tokenAmount.decimals;
      
      // Only include tokens that are in our DEFAULT_SOLANA_TOKENS list
      const tokenDef = DEFAULT_SOLANA_TOKENS.find(token => token.mint_address === mintAddress);
      if (tokenDef) {
        const tokenFormatted = Number(balance) / Math.pow(10, decimals);
        const tokenPrice = prices[tokenDef.symbol] || 0;
        const tokenUsdValue = tokenFormatted * tokenPrice;
        
        balances.push({
          mint_address: mintAddress,
          balance,
          balance_formatted: tokenFormatted.toFixed(decimals > 6 ? 6 : decimals),
          usd_value: tokenUsdValue.toFixed(2)
        });
      }
    }
    
    return balances;
  } catch (error) {
    console.error('Error fetching Solana balances:', error);
    return [];
  }
};

/**
 * Get user's Solana address from connected wallet with auto-connect attempt
 */
export const getUserSolanaAddress = async (): Promise<string | null> => {
  try {
    const { SolanaService } = await import('$lib/services/solana/SolanaService');
    
    // First try to get address if already connected
    let address = await SolanaService.getUserSolanaAddress();
    
    // If no address and we have Solana capabilities, try to connect
    if (!address) {
      const capabilities = SolanaService.getSolanaCapabilities();
      if (capabilities.canGetAddress && capabilities.walletType) {
        try {
          console.log('🔄 Attempting to auto-connect Solana wallet for balance fetching...');
          address = await SolanaService.connectSolanaWallet();
          console.log('✅ Auto-connected to Solana wallet:', address?.slice(0, 8) + '...');
        } catch (connectError) {
          console.log('ℹ️ Could not auto-connect to Solana wallet:', connectError.message);
          // Don't throw, just return null so it fails gracefully
        }
      }
    }
    
    return address;
  } catch (error) {
    console.error('Error getting user Solana address:', error);
    return null;
  }
};