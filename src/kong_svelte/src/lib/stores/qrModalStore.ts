import { writable } from 'svelte/store';

type QRModalState = {
  isOpen: boolean;
  qrData: string;
  title: string;
  address: string;
};

function createQRModalStore() {
  const { subscribe, set, update } = writable<QRModalState>({
    isOpen: false,
    qrData: '',
    title: '',
    address: ''
  });

  return {
    subscribe,
    show: (qrData: string, title: string, address: string) => {
      set({ isOpen: true, qrData, title, address });
    },
    hide: () => {
      set({ isOpen: false, qrData: '', title: '', address: '' });
    }
  };
}

export const qrModalStore = createQRModalStore(); 