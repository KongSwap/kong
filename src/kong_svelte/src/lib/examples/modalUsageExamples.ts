/**
 * Modal Usage Examples
 * 
 * This file demonstrates how to use the new unified modal system
 * for common patterns throughout the KongSwap application.
 */

import { modalFactory, modals } from '$lib/components/common/modals';

// ===============================
// 1. CONFIRMATION DIALOGS
// ===============================

export async function confirmDeletePool() {
  const confirmed = await modalFactory.confirmations.delete('liquidity pool');
  if (confirmed) {
    console.log('Pool deletion confirmed');
  }
}

export async function confirmSwapTransaction() {
  const confirmed = await modals.confirm({
    title: 'Confirm Swap',
    variant: 'info',
    message: 'Are you sure you want to execute this swap?',
    confirmText: 'Execute Swap',
    cancelText: 'Cancel'
  });
  return confirmed;
}

// ===============================
// 2. FORM DIALOGS
// ===============================

export async function getSlippageTolerance() {
  try {
    const result = await modalFactory.swap.slippage(0.5);
    return result.slippage;
  } catch (error) {
    console.log('User cancelled slippage setting');
    return null;
  }
}

export async function sendTokenForm() {
  try {
    const formData = await modals.form({
      title: 'Send Token',
      fields: [
        {
          key: 'recipient',
          label: 'Recipient Address',
          type: 'text',
          placeholder: 'Enter wallet address',
          required: true,
          validation: (value: string) => {
            if (value.length < 10) return 'Invalid address format';
            return null;
          }
        },
        {
          key: 'amount',
          label: 'Amount',
          type: 'number',
          placeholder: '0.00',
          required: true,
          validation: (value: string) => {
            const num = parseFloat(value);
            if (isNaN(num) || num <= 0) return 'Amount must be greater than 0';
            return null;
          }
        },
        {
          key: 'memo',
          label: 'Memo (Optional)',
          type: 'text',
          placeholder: 'Optional memo',
          required: false
        }
      ],
      submitText: 'Send'
    });

    console.log('Send token form data:', formData);
    return formData;
  } catch (error) {
    console.log('User cancelled send form');
    return null;
  }
}

// ===============================
// 3. SELECTOR DIALOGS
// ===============================

export async function selectToken(tokens: any[]) {
  try {
    const selectedToken = await modalFactory.selectors.token(tokens);
    console.log('Selected token:', selectedToken);
    return selectedToken;
  } catch (error) {
    console.log('User cancelled token selection');
    return null;
  }
}

export async function selectWallet(wallets: any[]) {
  try {
    const selectedWallet = await modalFactory.selectors.wallet(wallets);
    console.log('Selected wallet:', selectedWallet);
    return selectedWallet;
  } catch (error) {
    console.log('User cancelled wallet selection');
    return null;
  }
}

// ===============================
// 4. WALLET OPERATIONS
// ===============================

export async function showSignatureRequest(message: string) {
  try {
    await modalFactory.wallet.signature(message);
    console.log('Signature completed');
    return true;
  } catch (error) {
    console.log('Signature cancelled or failed');
    return false;
  }
}

export async function showQRCode(address: string) {
  try {
    await modalFactory.wallet.qr(address, 'Receive Payment', address);
    console.log('QR modal closed');
  } catch (error) {
    console.log('QR modal cancelled');
  }
}

// ===============================
// 5. PREDICTION MARKET OPERATIONS
// ===============================

export async function placeBet(market: any, outcome: string) {
  try {
    const betData = await modalFactory.prediction.bet(market, outcome);
    console.log('Bet placed:', betData);
    return betData;
  } catch (error) {
    console.log('Bet cancelled');
    return null;
  }
}

// ===============================
// 6. CUSTOM MODAL PATTERNS
// ===============================

export async function showCustomModal(component: any, props: any = {}) {
  try {
    const result = await modals.custom({
      title: 'Custom Modal',
      component,
      props,
      width: '600px'
    });
    return result;
  } catch (error) {
    console.log('Custom modal cancelled');
    return null;
  }
}

// ===============================
// 7. ADVANCED USAGE PATTERNS
// ===============================

export async function sequentialModals() {
  try {
    // Step 1: Get user confirmation
    const confirmed = await modals.confirm({
      title: 'Multi-step Process',
      message: 'This will involve multiple steps. Continue?',
      variant: 'info'
    });

    if (!confirmed) return null;

    // Step 2: Get form data
    const formData = await modals.form({
      title: 'Step 2: Enter Details',
      fields: [
        {
          key: 'name',
          label: 'Name',
          type: 'text',
          required: true
        }
      ]
    });

    // Step 3: Final confirmation
    const finalConfirmed = await modals.confirm({
      title: 'Confirm Details',
      message: `Name: ${formData.name}. Proceed?`,
      variant: 'success'
    });

    return finalConfirmed ? formData : null;
  } catch (error) {
    console.log('Sequential modal flow cancelled');
    return null;
  }
}

export async function concurrentModals() {
  // Show multiple modals at once (they will stack properly)
  const [result1, result2] = await Promise.allSettled([
    modals.confirm({
      title: 'First Confirmation',
      message: 'Confirm first action?'
    }),
    modals.form({
      title: 'Data Entry',
      fields: [{
        key: 'data',
        label: 'Enter data',
        type: 'text',
        required: true
      }]
    })
  ]);

  return { result1, result2 };
}

// ===============================
// 8. ERROR HANDLING PATTERNS
// ===============================

export async function safeModalOperation<T>(
  modalOperation: () => Promise<T>,
  fallbackValue: T
): Promise<T> {
  try {
    return await modalOperation();
  } catch (error) {
    console.log('Modal operation failed or cancelled:', error);
    return fallbackValue;
  }
}

// Usage example:
export async function safeTokenSelection(tokens: any[]) {
  return safeModalOperation(
    () => modalFactory.selectors.token(tokens),
    null // fallback if cancelled
  );
}

// ===============================
// 9. MIGRATION HELPERS
// ===============================

/**
 * Helper function to gradually migrate existing modals.
 * Provides both old and new patterns during transition.
 */
export function createMigrationWrapper(
  legacyModalFn: () => void,
  newModalFn: () => Promise<any>,
  useNewSystem: boolean = false
) {
  return useNewSystem ? newModalFn : legacyModalFn;
}

// Usage:
export const showSendModal = createMigrationWrapper(
  () => {
    // Legacy modal opening logic
    console.log('Opening legacy send modal');
  },
  async () => {
    // New modal system
    return await modalFactory.wallet.send();
  },
  true // Set to true to use new system
);

// ===============================
// 10. TYPESCRIPT PATTERNS
// ===============================

interface TokenSendData {
  recipient: string;
  amount: string;
  memo?: string;
}

export async function typedSendToken(): Promise<TokenSendData | null> {
  try {
    const result = await modals.form<TokenSendData>({
      title: 'Send Token',
      fields: [
        {
          key: 'recipient',
          label: 'Recipient',
          type: 'text',
          required: true
        },
        {
          key: 'amount',
          label: 'Amount',
          type: 'number',
          required: true
        },
        {
          key: 'memo',
          label: 'Memo',
          type: 'text',
          required: false
        }
      ]
    });

    return result as TokenSendData;
  } catch {
    return null;
  }
}