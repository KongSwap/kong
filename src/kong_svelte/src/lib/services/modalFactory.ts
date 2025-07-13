import { modals, type ModalProps } from '$lib/stores/modalManager';

// Predefined modal configurations for common use cases
export const modalFactory = {
  // Confirmation dialogs
  confirmations: {
    /**
     * Delete confirmation with danger styling
     */
    delete: (item: string = 'item') => modals.confirm({
      title: 'Confirm Deletion',
      variant: 'danger',
      message: `Are you sure you want to delete this ${item}? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel'
    }),

    /**
     * Destructive action confirmation
     */
    destructive: (action: string, item?: string) => modals.confirm({
      title: 'Confirm Action',
      variant: 'warning',
      message: `Are you sure you want to ${action}${item ? ` ${item}` : ''}? This action cannot be undone.`,
      confirmText: 'Continue',
      cancelText: 'Cancel'
    }),

    /**
     * Save confirmation
     */
    save: (hasChanges: boolean = true) => modals.confirm({
      title: hasChanges ? 'Save Changes?' : 'No Changes',
      variant: hasChanges ? 'info' : 'warning',
      message: hasChanges 
        ? 'You have unsaved changes. Would you like to save them before continuing?'
        : 'No changes have been made.',
      confirmText: hasChanges ? 'Save' : 'OK',
      cancelText: hasChanges ? 'Discard' : undefined
    }),

    /**
     * Leave page confirmation
     */
    leavePage: () => modals.confirm({
      title: 'Leave Page?',
      variant: 'warning',
      message: 'You have unsaved changes. Are you sure you want to leave this page?',
      confirmText: 'Leave',
      cancelText: 'Stay'
    }),

    /**
     * Error notification
     */
    error: (title: string, message: string) => modals.confirm({
      title,
      variant: 'danger',
      message,
      confirmText: 'OK',
      cancelText: undefined
    })
  },

  // Form dialogs
  forms: {
    /**
     * Simple text input form
     */
    textInput: (label: string, placeholder?: string, required: boolean = true) => modals.form({
      title: `Enter ${label}`,
      fields: [{
        key: 'value',
        label,
        type: 'text',
        placeholder,
        required
      }],
      submitText: 'Submit'
    }),

    /**
     * Email input form
     */
    email: (title: string = 'Enter Email') => modals.form({
      title,
      fields: [{
        key: 'email',
        label: 'Email Address',
        type: 'email',
        placeholder: 'user@example.com',
        required: true
      }],
      submitText: 'Submit'
    }),

    /**
     * Password form
     */
    password: (requireConfirmation: boolean = false) => {
      const fields = [{
        key: 'password',
        label: 'Password',
        type: 'password' as const,
        required: true
      }];

      if (requireConfirmation) {
        fields.push({
          key: 'confirmPassword',
          label: 'Confirm Password',
          type: 'password' as const,
          required: true,
          validation: (value: string, formData: any) => {
            if (value !== formData.password) {
              return 'Passwords do not match';
            }
            return null;
          }
        });
      }

      return modals.form({
        title: 'Enter Password',
        fields,
        submitText: 'Submit'
      });
    },

    /**
     * Contact form
     */
    contact: () => modals.form({
      title: 'Contact Us',
      fields: [
        {
          key: 'name',
          label: 'Name',
          type: 'text',
          required: true
        },
        {
          key: 'email',
          label: 'Email',
          type: 'email',
          required: true
        },
        {
          key: 'subject',
          label: 'Subject',
          type: 'text',
          required: true
        },
        {
          key: 'message',
          label: 'Message',
          type: 'textarea',
          required: true
        }
      ],
      submitText: 'Send Message',
      width: '600px'
    })
  },

  // Selector dialogs
  selectors: {
    /**
     * Token selector
     */
    token: (tokens: any[]) => modals.select({
      title: 'Select Token',
      items: tokens,
      searchable: true,
      searchPlaceholder: 'Search tokens...',
      displayKey: (token: any) => token.symbol || token.name,
      width: '500px',
      height: '600px'
    }),

    /**
     * Wallet selector
     */
    wallet: (wallets: any[]) => modals.select({
      title: 'Connect Wallet',
      items: wallets,
      searchable: false,
      displayKey: (wallet: any) => wallet.name,
      width: '450px'
    }),

    /**
     * Generic list selector
     */
    list: <T>(
      items: T[], 
      title: string = 'Select Item',
      displayKey?: keyof T | ((item: T) => string)
    ) => modals.select({
      title,
      items,
      searchable: true,
      displayKey,
      width: '500px'
    })
  },

  // Wallet-specific modals
  wallet: {
    /**
     * Send token modal
     */
    send: (token?: any) => modals.form({
      title: `Send ${token?.symbol || 'Token'}`,
      fields: [
        {
          key: 'recipient',
          label: 'Recipient Address',
          type: 'text',
          placeholder: 'Enter wallet address',
          required: true,
          validation: (value: string) => {
            // Basic validation - you'd want more robust validation
            if (value.length < 10) {
              return 'Invalid address format';
            }
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
            if (isNaN(num) || num <= 0) {
              return 'Amount must be greater than 0';
            }
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
      submitText: 'Send',
      width: '500px'
    }),

    /**
     * Signature request modal
     */
    signature: (message: string, details?: string) => modals.signature({
      title: 'Signature Required',
      message,
      width: '500px'
    }),

    /**
     * QR code display
     */
    qr: (data: string, title: string = 'QR Code', address?: string) => modals.qr({
      title,
      qrData: data,
      address,
      width: '400px'
    }),

    /**
     * Manage tokens modal - simplified selector version
     */
    manageTokens: (availableTokens: any[], enabledTokens: Set<string>) => {
      const formattedTokens = availableTokens.map(token => ({
        ...token,
        enabled: enabledTokens.has(token.address),
        displayText: `${token.symbol} - ${token.name}`
      }));

      return modals.select({
        title: 'Manage Tokens',
        items: formattedTokens,
        searchable: true,
        searchPlaceholder: 'Search tokens...',
        displayKey: 'displayText',
        multiSelect: true,
        width: '600px',
        height: '500px'
      });
    }
  },

  // Swap-specific modals
  swap: {
    /**
     * Swap confirmation
     */
    confirmation: (fromToken: any, toToken: any, amount: string, rate: string) => modals.confirm({
      title: 'Confirm Swap',
      variant: 'info',
      message: `Swap ${amount} ${fromToken.symbol} for ${toToken.symbol} at rate ${rate}?`,
      confirmText: 'Confirm Swap',
      cancelText: 'Cancel'
    }),

    /**
     * Slippage tolerance setting
     */
    slippage: (currentSlippage: number) => modals.form({
      title: 'Set Slippage Tolerance',
      fields: [{
        key: 'slippage',
        label: 'Slippage Tolerance (%)',
        type: 'number',
        placeholder: currentSlippage.toString(),
        required: true,
        validation: (value: string) => {
          const num = parseFloat(value);
          if (isNaN(num) || num < 0.1 || num > 50) {
            return 'Slippage must be between 0.1% and 50%';
          }
          return null;
        }
      }],
      submitText: 'Update',
      width: '400px'
    })
  },

  // Prediction market modals
  prediction: {
    /**
     * Place bet modal
     */
    bet: (market: any, outcome: string) => modals.form({
      title: `Bet on "${outcome}"`,
      fields: [
        {
          key: 'amount',
          label: 'Bet Amount',
          type: 'number',
          placeholder: '0.00',
          required: true,
          validation: (value: string) => {
            const num = parseFloat(value);
            if (isNaN(num) || num <= 0) {
              return 'Amount must be greater than 0';
            }
            return null;
          }
        }
      ],
      submitText: 'Place Bet',
      width: '450px'
    }),

    /**
     * Market resolution (admin)
     */
    resolve: (market: any, outcomes: string[]) => modals.select({
      title: 'Resolve Market',
      items: outcomes.map(outcome => ({ id: outcome, name: outcome })),
      displayKey: 'name',
      width: '400px'
    })
  }
};

// Utility function to create custom modal factories
export function createModalFactory<T extends Record<string, any>>(
  config: T
): T {
  return config;
}

// Export individual factories for convenience
export const {
  confirmations,
  forms,
  selectors,
  wallet,
  swap,
  prediction
} = modalFactory;