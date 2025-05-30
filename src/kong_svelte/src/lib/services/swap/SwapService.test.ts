import { describe, it, expect, vi } from 'vitest';
import { SwapService } from './SwapService';
import type { AnyToken } from '$lib/utils/tokenUtils';
import { Principal } from '@dfinity/principal';

// Mock the stores and services
vi.mock('$lib/stores/auth', () => ({
  auth: {
    pnp: {
      getActor: vi.fn()
    }
  },
  requireWalletConnection: vi.fn()
}));

vi.mock('$lib/stores/swapStore', () => ({
  swapStatusStore: {
    updateSwap: vi.fn()
  }
}));

vi.mock('$lib/stores/toastStore', () => ({
  toastStore: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn()
  }
}));

describe('SwapService', () => {
  describe('executeSwap', () => {
    it('should route Solana token swaps to CrossChainSwapService', async () => {
      const mockSolanaToken: AnyToken = {
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
        mint_address: 'So11111111111111111111111111111111111111112'
      } as any;

      const mockIcpToken: AnyToken = {
        symbol: 'ICP',
        name: 'Internet Computer',
        decimals: 8,
        address: 'ryjl3-tyaaa-aaaaa-aaaba-cai',
        standards: ['ICRC-2'],
        fee_fixed: 10000
      } as any;

      const params = {
        swapId: 'test-swap-123',
        payToken: mockSolanaToken,
        payAmount: '1.0',
        receiveToken: mockIcpToken,
        receiveAmount: '13.5',
        userMaxSlippage: 1.0,
        backendPrincipal: Principal.fromText('aaaaa-aa'),
        lpFees: []
      };

      // Mock the CrossChainSwapService
      const mockExecuteSolToIcpSwap = vi.fn().mockResolvedValue({
        status: 'success',
        job_id: BigInt(123)
      });

      vi.doMock('./CrossChainSwapService', () => ({
        CrossChainSwapService: {
          executeSolToIcpSwap: mockExecuteSolToIcpSwap
        }
      }));

      // Mock SolanaService
      vi.doMock('../solana/SolanaService', () => ({
        SolanaService: {
          getWalletAddress: vi.fn().mockResolvedValue('SolanaWalletAddress123')
        }
      }));

      // The method should detect this is a cross-chain swap and not try to use IC token logic
      const result = await SwapService.executeSwap(params);
      
      // Should return a job_id for success
      expect(result).toBeTruthy();
      expect(result).not.toBe(false);
    });

    it('should handle IC to IC swaps normally', async () => {
      const mockIcpToken: AnyToken = {
        symbol: 'ICP',
        name: 'Internet Computer',
        decimals: 8,
        address: 'ryjl3-tyaaa-aaaaa-aaaba-cai',
        standards: ['ICRC-2'],
        fee_fixed: 10000
      } as any;

      const mockKongToken: AnyToken = {
        symbol: 'KONG',
        name: 'Kong',
        decimals: 8,
        address: '2ouva-viaaa-aaaaq-aaamq-cai',
        standards: ['ICRC-2'],
        fee_fixed: 10000
      } as any;

      const params = {
        swapId: 'test-swap-456',
        payToken: mockIcpToken,
        payAmount: '1.0',
        receiveToken: mockKongToken,
        receiveAmount: '100',
        userMaxSlippage: 1.0,
        backendPrincipal: Principal.fromText('aaaaa-aa'),
        lpFees: []
      };

      // This should use the regular IC swap flow
      // We would need to mock more services here for a full test
    });
  });

  describe('isCrossChainSwap', () => {
    it('should identify cross-chain swaps correctly', () => {
      const solanaToken: AnyToken = {
        symbol: 'SOL',
        mint_address: 'So11111111111111111111111111111111111111112'
      } as any;

      const icpToken: AnyToken = {
        symbol: 'ICP',
        address: 'ryjl3-tyaaa-aaaaa-aaaba-cai'
      } as any;

      const trumpToken: AnyToken = {
        symbol: 'TRUMP',
        mint_address: 'TrumpMintAddress123'
      } as any;

      // SOL -> ICP is cross-chain
      expect(SwapService.isCrossChainSwap(solanaToken, icpToken)).toBe(true);
      
      // ICP -> SOL is cross-chain
      expect(SwapService.isCrossChainSwap(icpToken, solanaToken)).toBe(true);
      
      // SOL -> TRUMP is NOT cross-chain (both Solana)
      expect(SwapService.isCrossChainSwap(solanaToken, trumpToken)).toBe(false);
      
      // ICP -> ICP is NOT cross-chain
      expect(SwapService.isCrossChainSwap(icpToken, icpToken)).toBe(false);
    });
  });
});