export const SOLANA_RPC_ENDPOINTS = {
  // Working devnet endpoints (free public endpoints)
  SOLANA_DEVNET: 'https://api.devnet.solana.com',
  SOLANA_DEVNET_2: 'https://devnet.solana.com',
  ANKR_DEVNET: 'https://rpc.ankr.com/solana_devnet',
  GETBLOCK_DEVNET: 'https://go.getblock.io/5ac1e14dd98a4316ba63c38e75f8dd78', // Free tier
  
  // Backup mainnet endpoints (if needed)
  SOLANA_MAINNET: 'https://api.mainnet-beta.solana.com',
};

export const getSolanaConnection = async () => {
  const { Connection } = await import('@solana/web3.js');
  
  // Try devnet endpoints in order of preference
  const endpoints = [
    SOLANA_RPC_ENDPOINTS.SOLANA_DEVNET,
    SOLANA_RPC_ENDPOINTS.SOLANA_DEVNET_2,
    SOLANA_RPC_ENDPOINTS.ANKR_DEVNET,
    SOLANA_RPC_ENDPOINTS.GETBLOCK_DEVNET,
  ];
  
  for (const endpoint of endpoints) {
    try {
      const connection = new Connection(endpoint, 'confirmed');
      // Test the connection
      await connection.getVersion();
      return connection;
    } catch (error) {
      console.warn(`Failed to connect to ${endpoint}:`, error);
      continue;
    }
  }
  
  throw new Error('Unable to connect to any Solana RPC endpoint');
}; 