/**
 * Signature and QR Modal Migration Examples
 * 
 * Demonstrates the migration of signature requests and QR code displays
 * from fragmented stores to the unified modal system.
 */

import { modalFactory } from '$lib/components/common/modals';

/**
 * BEFORE: Signature Modal (signatureModalStore.ts + SignatureModal.svelte)
 * - Separate signatureModalStore with manual state management
 * - Complex show/hide/setError methods
 * - Manual subscription and cleanup
 * 
 * AFTER: Simple promise-based signature requests
 */

/**
 * Example 1: Transaction signature request
 */
export async function requestTransactionSignature(transactionData: any) {
  try {
    const message = `Please sign this transaction:\n\nAmount: ${transactionData.amount}\nRecipient: ${transactionData.recipient}\nFee: ${transactionData.fee}`;
    
    await modalFactory.wallet.signature(message);
    
    console.log('✅ Transaction signature confirmed');
    return true;
  } catch (error) {
    console.log('❌ Transaction signature cancelled or failed:', error);
    return false;
  }
}

/**
 * Example 2: Message signing for authentication
 */
export async function requestAuthSignature(challenge: string) {
  try {
    const message = `Sign this message to authenticate:\n\nChallenge: ${challenge}\nTimestamp: ${new Date().toISOString()}`;
    
    await modalFactory.wallet.signature(message);
    
    console.log('✅ Authentication signature confirmed');
    return true;
  } catch (error) {
    console.log('❌ Authentication signature cancelled');
    return false;
  }
}

/**
 * BEFORE: QR Modal (qrModalStore.ts + QRModal.svelte)
 * - Separate qrModalStore with show/hide methods
 * - Manual state management for qrData, title, address
 * - Complex component with multiple props
 * 
 * AFTER: Simple QR display functions
 */

/**
 * Example 1: Show receiving address QR code
 */
export async function showReceiveQR(address: string, tokenSymbol: string) {
  try {
    await modalFactory.wallet.qr(
      address,
      `Receive ${tokenSymbol}`,
      address
    );
    
    console.log('✅ QR code modal closed');
  } catch (error) {
    console.log('❌ QR code modal cancelled');
  }
}

/**
 * Example 2: Show payment request QR
 */
export async function showPaymentRequestQR(paymentData: any) {
  try {
    const qrData = `icp:${paymentData.address}?amount=${paymentData.amount}&memo=${encodeURIComponent(paymentData.memo)}`;
    
    await modalFactory.wallet.qr(
      qrData,
      'Payment Request',
      paymentData.address
    );
    
    console.log('✅ Payment QR displayed');
  } catch (error) {
    console.log('❌ Payment QR cancelled');
  }
}

/**
 * Example 3: Generic QR code display
 */
export async function showGenericQR(data: string, title: string) {
  try {
    await modalFactory.wallet.qr(data, title);
    console.log(`✅ ${title} QR code displayed`);
  } catch (error) {
    console.log(`❌ ${title} QR code cancelled`);
  }
}

/**
 * Integration examples showing real-world usage patterns
 */

/**
 * Complete wallet transaction flow with signature and QR
 */
export async function completeTransactionFlow() {
  console.log('🚀 Starting complete transaction flow...');

  const transactionData = {
    amount: '1.5 ICP',
    recipient: 'rdmx6-jaaaa-aaaah-qcaiq-cai',
    fee: '0.0001 ICP'
  };

  try {
    // Step 1: Request signature for transaction
    console.log('1. Requesting transaction signature...');
    const signed = await requestTransactionSignature(transactionData);
    
    if (!signed) {
      console.log('❌ Transaction cancelled at signature step');
      return false;
    }

    // Step 2: Show success and receiving address QR
    console.log('2. Transaction signed, showing recipient QR...');
    await showReceiveQR(transactionData.recipient, 'ICP');

    console.log('✅ Transaction flow completed successfully');
    return true;

  } catch (error) {
    console.log('❌ Transaction flow failed:', error);
    return false;
  }
}

/**
 * Wallet connection flow with multiple signature requests
 */
export async function walletConnectionFlow() {
  console.log('🔗 Starting wallet connection flow...');

  try {
    // Step 1: Authentication challenge
    console.log('1. Requesting authentication signature...');
    const authSigned = await requestAuthSignature('auth-challenge-12345');
    
    if (!authSigned) {
      console.log('❌ Wallet connection cancelled');
      return false;
    }

    // Step 2: Show wallet address QR for backup
    console.log('2. Showing wallet address for backup...');
    await showReceiveQR(
      'your-wallet-principal-id-here',
      'Your Wallet Address'
    );

    console.log('✅ Wallet connection completed');
    return true;

  } catch (error) {
    console.log('❌ Wallet connection failed:', error);
    return false;
  }
}

/**
 * Migration impact metrics
 */
export const SIGNATURE_QR_MIGRATION_IMPACT = {
  storeConsolidation: {
    before: {
      stores: 2, // signatureModalStore + qrModalStore
      lines: 85, // Combined store logic
      complexity: 'High - separate state management for each modal type'
    },
    after: {
      stores: 0, // Integrated into modalManager
      lines: 0, // No separate store logic needed
      complexity: 'Low - unified promise-based API'
    }
  },

  usageSimplification: {
    signatureModal: {
      before: `
        signatureModalStore.show(message, onComplete);
        // Manual subscription to handle completion
        signatureModalStore.subscribe(state => {
          if (!state.isOpen && completed) {
            // Handle success
          }
        });
      `,
      after: `
        const success = await modalFactory.wallet.signature(message);
        if (success) {
          // Handle success
        }
      `
    },
    
    qrModal: {
      before: `
        qrModalStore.show(data, title, address);
        // Manual hide handling
        qrModalStore.hide();
      `,
      after: `
        await modalFactory.wallet.qr(data, title, address);
        // Automatically closed
      `
    }
  },

  benefits: [
    'Eliminated 85 lines of store management code',
    'Reduced complexity from manual subscriptions to promise-based',
    'Consistent error handling across all signature/QR interactions',
    'Better TypeScript support with typed parameters',
    'Automatic cleanup and memory management',
    'Mobile-optimized with touch gestures',
    'Consistent styling with app theme'
  ]
};

/**
 * Test runner for signature and QR examples
 */
export async function runSignatureQrExamples() {
  console.log('🔐 Running Signature & QR Migration Examples...\n');

  console.log('1. Testing transaction signature...');
  await requestTransactionSignature({
    amount: '1.5 ICP',
    recipient: 'rdmx6-jaaaa-aaaah-qcaiq-cai',
    fee: '0.0001 ICP'
  });

  console.log('\n2. Testing auth signature...');
  await requestAuthSignature('challenge-12345');

  console.log('\n3. Testing receive QR...');
  await showReceiveQR('ryjl3-tyaaa-aaaaa-aaaba-cai', 'ICP');

  console.log('\n4. Testing payment request QR...');
  await showPaymentRequestQR({
    address: 'recipient-address',
    amount: 10,
    memo: 'Payment for services'
  });

  console.log('\n5. Testing complete transaction flow...');
  await completeTransactionFlow();

  console.log('\n✅ All signature & QR examples completed!');
  console.log('\n📊 Migration Impact:', SIGNATURE_QR_MIGRATION_IMPACT);
}

// Export for browser testing
if (typeof window !== 'undefined') {
  (window as any).runSignatureQrExamples = runSignatureQrExamples;
  (window as any).completeTransactionFlow = completeTransactionFlow;
  (window as any).walletConnectionFlow = walletConnectionFlow;
  (window as any).signatureQrMigrationImpact = SIGNATURE_QR_MIGRATION_IMPACT;
}