import { writable } from 'svelte/store';

type QRModalState = {
  isOpen: boolean;
  qrData: string;
  title: string;
};

function createQRModalStore() {
  const { subscribe, set, update } = writable<QRModalState>({
    isOpen: false,
    qrData: '',
    title: ''
  });

  return {
    subscribe,
    show: (qrData: string, title: string) => {
      set({ isOpen: true, qrData, title });
    },
    hide: () => {
      set({ isOpen: false, qrData: '', title: '' });
    }
  };
}

export const qrModalStore = createQRModalStore(); 