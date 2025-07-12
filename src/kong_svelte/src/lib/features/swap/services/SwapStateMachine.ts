import { createMachine } from '@xstate/fsm';
import type { SwapMachineContext } from '../types/swap.types';

export type SwapMachineEvent =
  | { type: 'SELECT_TOKENS' }
  | { type: 'CONNECT_WALLET' }
  | { type: 'UPDATE_AMOUNT'; amount: string; field: 'pay' | 'receive' }
  | { type: 'QUOTE_SUCCESS'; quote: any }
  | { type: 'QUOTE_ERROR'; error: string }
  | { type: 'INITIATE_SWAP' }
  | { type: 'CONFIRM' }
  | { type: 'CANCEL' }
  | { type: 'SUCCESS'; txHash: string }
  | { type: 'FAILURE'; error: string }
  | { type: 'RESET' }
  | { type: 'RETRY' };

export type SwapMachineState =
  | { value: 'idle'; context: SwapMachineContext }
  | { value: 'connecting'; context: SwapMachineContext }
  | { value: 'quoting'; context: SwapMachineContext }
  | { value: 'ready'; context: SwapMachineContext }
  | { value: 'confirming'; context: SwapMachineContext }
  | { value: 'executing'; context: SwapMachineContext }
  | { value: 'complete'; context: SwapMachineContext }
  | { value: 'error'; context: SwapMachineContext };

const initialContext: SwapMachineContext = {
  formValues: {
    payToken: null,
    payAmount: '',
    receiveToken: null,
    receiveAmount: '',
  },
  quote: null,
  error: null,
  txHash: null,
};

export const swapMachine = createMachine<
  SwapMachineContext,
  SwapMachineEvent,
  SwapMachineState
>({
  id: 'swap',
  initial: 'idle',
  context: initialContext,
  states: {
    idle: {
      on: {
        SELECT_TOKENS: 'quoting',
        CONNECT_WALLET: 'connecting',
        UPDATE_AMOUNT: {
          target: 'quoting',
          actions: (context, event) => {
            if (event.type === 'UPDATE_AMOUNT') {
              if (event.field === 'pay') {
                context.formValues.payAmount = event.amount;
              } else {
                context.formValues.receiveAmount = event.amount;
              }
            }
          },
        },
      },
    },
    connecting: {
      on: {
        // This state would be managed by wallet connection logic
        SELECT_TOKENS: 'quoting',
        CANCEL: 'idle',
      },
    },
    quoting: {
      on: {
        QUOTE_SUCCESS: {
          target: 'ready',
          actions: (context, event) => {
            if (event.type === 'QUOTE_SUCCESS') {
              context.quote = event.quote;
              context.error = null;
            }
          },
        },
        QUOTE_ERROR: {
          target: 'error',
          actions: (context, event) => {
            if (event.type === 'QUOTE_ERROR') {
              context.error = event.error;
            }
          },
        },
        UPDATE_AMOUNT: {
          target: 'quoting',
          actions: (context, event) => {
            if (event.type === 'UPDATE_AMOUNT') {
              if (event.field === 'pay') {
                context.formValues.payAmount = event.amount;
              } else {
                context.formValues.receiveAmount = event.amount;
              }
            }
          },
        },
      },
    },
    ready: {
      on: {
        INITIATE_SWAP: 'confirming',
        UPDATE_AMOUNT: {
          target: 'quoting',
          actions: (context, event) => {
            if (event.type === 'UPDATE_AMOUNT') {
              if (event.field === 'pay') {
                context.formValues.payAmount = event.amount;
              } else {
                context.formValues.receiveAmount = event.amount;
              }
            }
          },
        },
      },
    },
    confirming: {
      on: {
        CONFIRM: 'executing',
        CANCEL: 'ready',
      },
    },
    executing: {
      on: {
        SUCCESS: {
          target: 'complete',
          actions: (context, event) => {
            if (event.type === 'SUCCESS') {
              context.txHash = event.txHash;
              context.error = null;
            }
          },
        },
        FAILURE: {
          target: 'error',
          actions: (context, event) => {
            if (event.type === 'FAILURE') {
              context.error = event.error;
            }
          },
        },
      },
    },
    complete: {
      on: {
        RESET: {
          target: 'idle',
          actions: (context) => {
            // Reset context to initial state
            Object.assign(context, initialContext);
          },
        },
      },
    },
    error: {
      on: {
        RETRY: {
          target: 'idle',
          actions: (context) => {
            context.error = null;
          },
        },
        RESET: {
          target: 'idle',
          actions: (context) => {
            // Reset context to initial state
            Object.assign(context, initialContext);
          },
        },
      },
    },
  },
});

// Helper function to check if we can execute swap
export function canExecuteSwap(state: SwapMachineState['value']): boolean {
  return state === 'ready';
}

// Helper function to check if we should show confirmation
export function shouldShowConfirmation(state: SwapMachineState['value']): boolean {
  return state === 'confirming';
}

// Helper function to check if swap is in progress
export function isSwapInProgress(state: SwapMachineState['value']): boolean {
  return state === 'executing';
}

// Helper function to get button text based on state
export function getButtonTextFromState(state: SwapMachineState['value']): string {
  switch (state) {
    case 'idle':
      return 'Enter Amount';
    case 'connecting':
      return 'Connecting...';
    case 'quoting':
      return 'Getting Quote...';
    case 'ready':
      return 'Swap';
    case 'confirming':
      return 'Confirm Swap';
    case 'executing':
      return 'Swapping...';
    case 'complete':
      return 'Swap Complete';
    case 'error':
      return 'Retry';
    default:
      return 'Swap';
  }
}

// Helper function to determine if button should be disabled
export function isButtonDisabled(state: SwapMachineState['value']): boolean {
  return ['quoting', 'executing', 'complete'].includes(state);
}