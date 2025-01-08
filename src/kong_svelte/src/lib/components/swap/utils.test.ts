import { vi } from 'vitest';

// Mock needs to be before other imports
vi.mock('$app/navigation', () => ({
  replaceState: vi.fn()
}));

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getButtonText, updateURL, clickOutside } from '$lib/components/swap/utils';
import { replaceState } from '$app/navigation';

describe('getButtonText', () => {
  const defaultParams = {
    isCalculating: false,
    isValidInput: true,
    isProcessing: false,
    error: null,
    swapSlippage: 0.1,
    userMaxSlippage: 1,
    isConnected: true,
    payTokenSymbol: 'ETH',
    receiveTokenSymbol: 'USDC'
  };

  it('should return "Connect Wallet" when not connected', () => {
    expect(getButtonText({ ...defaultParams, isConnected: false })).toBe('Connect Wallet');
  });

  it('should return "Processing..." when processing', () => {
    expect(getButtonText({ ...defaultParams, isProcessing: true })).toBe('Processing...');
  });

  it('should return "Calculating..." when calculating', () => {
    expect(getButtonText({ ...defaultParams, isCalculating: true })).toBe('Calculating...');
  });

  it('should return error message when there is an error', () => {
    expect(getButtonText({ ...defaultParams, error: 'Insufficient balance' }))
      .toBe('Insufficient balance');
  });

  it('should return "Select Tokens" when tokens are not selected', () => {
    expect(getButtonText({ ...defaultParams, payTokenSymbol: '', receiveTokenSymbol: '' }))
      .toBe('Select Tokens');
  });

  it('should return "Enter Amount" when input is invalid', () => {
    expect(getButtonText({ ...defaultParams, isValidInput: false }))
      .toBe('Enter Amount');
  });

  it('should return "Swap Anyway" when slippage exceeds max', () => {
    expect(getButtonText({ 
      ...defaultParams, 
      swapSlippage: 2,
      userMaxSlippage: 1
    })).toBe('Swap Anyway');
  });

  it('should return "Ready to Swap" in normal conditions', () => {
    expect(getButtonText(defaultParams)).toBe('Ready to Swap');
  });
});

describe('updateURL', () => {
  let originalWindow: any;

  beforeEach(() => {
    originalWindow = global.window;
    // Mock window.location
    const location = new URL('http://localhost:3000');
    global.window = {
      location: {
        href: location.href
      }
    } as any;
  });

  afterEach(() => {
    global.window = originalWindow;
    vi.clearAllMocks();
  });

  it('should update URL with from and to parameters', () => {
    updateURL({ from: 'ETH', to: 'USDC' });

    expect(vi.mocked(replaceState)).toHaveBeenCalledWith(
      'http://localhost:3000/?from=ETH&to=USDC',
      {}
    );
  });
});

describe('clickOutside', () => {
  let node: HTMLElement;
  let callback: () => void;

  beforeEach(() => {
    node = document.createElement('div');
    document.body.appendChild(node);
    callback = vi.fn();
  });

  afterEach(() => {
    document.body.removeChild(node);
    vi.clearAllMocks();
  });

  it('should call callback when clicking outside when enabled', () => {
    const action = clickOutside(node, { enabled: true, callback });
    
    // Click outside
    document.body.click();
    expect(callback).toHaveBeenCalled();

    // Cleanup
    action.destroy();
  });

  it('should not call callback when clicking inside when enabled', () => {
    const action = clickOutside(node, { enabled: true, callback });
    
    // Click inside
    node.click();
    expect(callback).not.toHaveBeenCalled();

    // Cleanup
    action.destroy();
  });

  it('should not call callback when disabled', () => {
    const action = clickOutside(node, { enabled: false, callback });
    
    // Click outside
    document.body.click();
    expect(callback).not.toHaveBeenCalled();

    // Cleanup
    action.destroy();
  });

  it('should update enabled state', () => {
    const action = clickOutside(node, { enabled: false, callback });
    
    // Initially disabled
    document.body.click();
    expect(callback).not.toHaveBeenCalled();

    // Update to enabled
    action.update({ enabled: true });
    document.body.click();
    expect(callback).toHaveBeenCalled();

    // Cleanup
    action.destroy();
  });

  it('should properly clean up event listeners', () => {
    const action = clickOutside(node, { enabled: true, callback });
    
    // Initial click works
    document.body.click();
    expect(callback).toHaveBeenCalledTimes(1);

    // Destroy action
    action.destroy();

    // Click after destroy should not trigger callback
    document.body.click();
    expect(callback).toHaveBeenCalledTimes(1);
  });
}); 