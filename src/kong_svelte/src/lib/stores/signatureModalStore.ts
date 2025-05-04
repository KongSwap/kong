import { writable } from 'svelte/store';

interface SignatureModalState {
  isOpen: boolean;
  message: string;
  error: string;
  onSignatureComplete?: () => void;
}

const initialState: SignatureModalState = {
  isOpen: false,
  message: '',
  error: '',
};

function createSignatureModalStore() {
  const { subscribe, update, set } = writable<SignatureModalState>(initialState);

  return {
    subscribe,
    show: (message: string, onSignatureComplete?: () => void) => {
      update(state => ({
        ...state,
        isOpen: true,
        message,
        error: '',
        onSignatureComplete,
      }));
    },
    hide: () => {
      update(state => ({
        ...state,
        isOpen: false,
        message: '',
        error: '',
        onSignatureComplete: undefined,
      }));
    },
    setError: (error: string) => {
      update(state => ({
        ...state,
        error,
      }));
    },
    reset: () => {
      set(initialState);
    },
  };
}

export const signatureModalStore = createSignatureModalStore(); 