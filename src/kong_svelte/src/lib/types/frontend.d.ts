declare namespace FE {
    interface Transaction {
        id: string;
        timestamp: number;
        type: 'swap' | 'addLiquidity' | 'removeLiquidity';
        status: 'pending' | 'completed' | 'failed';
        // Swap specific fields
        payToken?: string;
        payAmount?: string;
        receiveToken?: string;
        receiveAmount?: string;
        // Liquidity specific fields
        token0?: string;
        amount0?: string;
        token1?: string;
        amount1?: string;
        lpTokenAmount?: string;
    }
} 
